import * as vscode from "vscode";

// ─── Public types ────────────────────────────────────────────────────────────

/**
 * Represents a single parsed Python block (def, class, if, for, …).
 *
 * `openRange`    — zero-width position of the colon that closes the header line.
 * `closeRange`   — zero-width position at the end of the last content line.
 * `headerEndLine`— line number of the line that contains the closing colon
 *                  (may differ from openRange.start.line for multi-line headers).
 */
export interface CodeBlock {
  openRange: vscode.Range;
  closeRange: vscode.Range;
  headerEndLine: number;
}

// ─── Internal types ───────────────────────────────────────────────────────────

/** One entry on the block-detection stack while scanning the document. */
interface BlockStackItem {
  indent: number;
  startLine: number;
  colonPosition: number;
  headerEndLine: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * All Python keywords that introduce an indented block.
 * `async` is intentionally last — it always precedes `def` or `for`, but the
 * regex matches the whole `async def` / `async for` line because we only test
 * the *keyword* at the start of the trimmed line.
 */
const BLOCK_KEYWORDS = [
  "def",
  "class",
  "if",
  "elif",
  "else",
  "for",
  "while",
  "try",
  "except",
  "finally",
  "with",
  "match",
  "case",
  "async",
];

// ─── Header detection ─────────────────────────────────────────────────────────

/**
 * Given a `startLine` that begins with a block keyword, scans forward until it
 * finds the closing `:` of the header (handling multi-line signatures with
 * open parentheses/brackets).
 *
 * Returns `undefined` when the candidate turns out to be a false positive —
 * e.g. a dangling `if x:` at the bottom of the file with nothing indented below.
 */
function tryGetBlockHeader(
  document: vscode.TextDocument,
  startLine: number,
): { startLine: number; colonLine: number; colonPosition: number } | undefined {
  const firstLineText = document.lineAt(startLine).text;
  // Strip inline comments before checking the keyword — avoids matching
  // something like `# if x:` as a block header.
  const firstLineCodePart = firstLineText.split(/#.*/)[0].trim();

  const isKeyword = BLOCK_KEYWORDS.some((keyword) =>
    new RegExp(`^${keyword}\\b`).test(firstLineCodePart),
  );
  if (!isKeyword) {
    return undefined;
  }

  // Track open parens/brackets so we can correctly handle multi-line signatures:
  //   def foo(
  //     bar,      ← still inside the paren, not the end of the header
  //     baz,
  //   ):          ← paren closed AND ends with ':', this is the real header end
  let parenLevel = 0;
  let lineNum = startLine;

  while (lineNum < document.lineCount) {
    const line = document.lineAt(lineNum);
    const codePart = line.text.split(/#.*/)[0];
    const trimmed = codePart.trim();

    // ── Inline single-line block: `if cond: body` all on one line ───────────────
    // Only relevant on the very first line — inline blocks can't span multiple lines.
    // We scan for a `:` at paren-depth 0 with non-comment, non-empty content after
    // it. If found, the body lives on the same line as the header, so we return
    // immediately without needing the "next line must be indented" guard.
    if (lineNum === startLine) {
      let depth = 0;
      for (let i = 0; i < codePart.length; i++) {
        const ch = codePart[i];
        if ("([{".includes(ch)) {
          depth++;
        } else if (")]}".includes(ch)) {
          depth--;
        } else if (ch === ":" && depth === 0) {
          const afterColon = codePart.slice(i + 1).trim();
          if (afterColon && !afterColon.startsWith("#")) {
            // Real body exists on this line — it's a valid inline block.
            return { startLine, colonLine: startLine, colonPosition: i + 1 };
          }
          // Nothing after the colon (e.g. `if x:`) — fall through to the
          // normal multi-line header logic below.
          break;
        }
      }
    }

    for (const ch of codePart) {
      if ("([{".includes(ch)) {
        parenLevel++;
      } else if (")]}".includes(ch)) {
        parenLevel--;
      }
    }

    // A line ending with `:` at paren depth 0 is the header's closing line.
    if (trimmed.endsWith(":") && parenLevel === 0) {
      const colonPos = line.text.lastIndexOf(":") + 1;

      // Guard against false positives: a bare `if x:` followed immediately by
      // something at the same or lower indentation (or nothing at all) is NOT
      // a real block. We skip any blank lines before checking — empty lines
      // between the header and the body are perfectly valid Python style.
      let peekLine = lineNum + 1;
      while (
        peekLine < document.lineCount &&
        document.lineAt(peekLine).isEmptyOrWhitespace
      ) {
        peekLine++;
      }
      const nextNonEmptyLine =
        peekLine < document.lineCount ? document.lineAt(peekLine) : null;

      if (
        !nextNonEmptyLine ||
        nextNonEmptyLine.firstNonWhitespaceCharacterIndex <=
          line.firstNonWhitespaceCharacterIndex
      ) {
        return undefined;
      }

      return { startLine, colonLine: lineNum, colonPosition: colonPos };
    }

    // Safety valve — 20 lines is way more than any realistic signature needs.
    if (lineNum > startLine + 20) {
      return undefined;
    }
    lineNum++;
  }

  return undefined;
}

// ─── Block-end helpers ────────────────────────────────────────────────────────

/**
 * Scans forward from `startLine` to find where the block whose header has
 * indentation `baseIndent` actually ends.  Blank lines and comment lines are
 * skipped — they don't count as dedents.
 */
function findBlockEnd(
  document: vscode.TextDocument,
  startLine: number,
  baseIndent: number,
): number {
  const lineCount = document.lineCount;

  for (let i = startLine + 1; i < lineCount; i++) {
    const line = document.lineAt(i);
    const trimmed = line.text.trim();

    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }

    if (line.firstNonWhitespaceCharacterIndex <= baseIndent) {
      // This line is back at (or past) the block's own indentation level,
      // so the block ended on the previous line.
      return i - 1;
    }
  }

  return lineCount - 1;
}

/**
 * Constructs a `CodeBlock` from a completed `BlockStackItem`, trimming any
 * trailing empty lines so the highlighted region ends on real content.
 */
function createBlock(
  document: vscode.TextDocument,
  block: BlockStackItem,
  endLine: number,
): CodeBlock {
  // Walk backwards past blank lines — we don't want the highlight to cover
  // a sea of whitespace at the bottom of the block.
  let lastContentLine = endLine;
  while (lastContentLine > block.startLine) {
    if (!document.lineAt(lastContentLine).isEmptyOrWhitespace) {
      break;
    }
    lastContentLine--;
  }

  const line = document.lineAt(lastContentLine);
  return {
    openRange: new vscode.Range(
      block.startLine,
      block.colonPosition,
      block.startLine,
      block.colonPosition,
    ),
    closeRange: new vscode.Range(
      lastContentLine,
      line.text.length,
      lastContentLine,
      line.text.length,
    ),
    headerEndLine: block.headerEndLine,
  };
}

// ─── Triple-quote pre-pass ────────────────────────────────────────────────────

/**
 * Returns the number of triple-quote tokens (`"""` or `'''`) on a single line.
 * Used to track whether we've entered or exited a multi-line string.
 */
function countTripleQuotes(text: string): number {
  let count = 0;
  const tripleDouble = text.match(/"""/g);
  if (tripleDouble) {
    count += tripleDouble.length;
  }
  const tripleSingle = text.match(/'''/g);
  if (tripleSingle) {
    count += tripleSingle.length;
  }
  return count;
}

/**
 * Pre-computes a boolean array where `inStringArr[i]` is `true` if line `i`
 * is *inside* a triple-quoted string (docstring or otherwise).
 *
 * Why bother? Docstrings can contain Python keywords:
 *   def foo():
 *     """
 *     if this were parsed literally:
 *         we'd think there's an 'if' block here ← wrong!
 *     """
 * By computing this upfront we can skip those lines entirely during parsing.
 */
function computeInStringArray(document: vscode.TextDocument): boolean[] {
  const inStringArr: boolean[] = [];
  let inString = false;

  for (let i = 0; i < document.lineCount; i++) {
    inStringArr.push(inString);
    // An odd number of triple-quote tokens on this line toggles the state.
    const count = countTripleQuotes(document.lineAt(i).text);
    if (count % 2 === 1) {
      inString = !inString;
    }
  }

  return inStringArr;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Scans the entire document and returns every Python block it can find.
 *
 * Strategy:
 *  1. Pre-compute which lines are inside triple-quoted strings so they're
 *     completely ignored during block detection.
 *  2. Walk line-by-line with an explicit stack (mimicking Python's own
 *     indentation-based scoping rules):
 *     - When the current line's indentation drops to or below the top of the
 *       stack, pop (close) those blocks.
 *     - When a line starts with a block keyword, push a new entry.
 *  3. After the loop, flush any blocks still open (they run to end-of-file).
 */
export function parsePythonBlocks(document: vscode.TextDocument): CodeBlock[] {
  const inStringArr = computeInStringArray(document);
  const blocks: CodeBlock[] = [];
  const stack: BlockStackItem[] = [];

  let lineNum = 0;

  while (lineNum < document.lineCount) {
    const line = document.lineAt(lineNum);

    // Blank lines never trigger block closure or open new blocks.
    if (line.isEmptyOrWhitespace) {
      lineNum++;
      continue;
    }

    // ── Block closure check ───────────────────────────────────────────────────
    // Only close blocks based on indentation if we're NOT inside a string —
    // indentation inside a docstring is meaningless to us.
    if (stack.length > 0 && !inStringArr[lineNum]) {
      const currentIndent = line.firstNonWhitespaceCharacterIndex;
      // Pop every block whose indentation is ≥ the current line's indent.
      while (
        stack.length > 0 &&
        currentIndent <= stack[stack.length - 1].indent
      ) {
        const closedBlock = stack.pop()!;
        const endLine = findBlockEnd(
          document,
          closedBlock.headerEndLine,
          closedBlock.indent,
        );
        blocks.push(createBlock(document, closedBlock, endLine));
      }
    }

    // ── Block opening check ───────────────────────────────────────────────────
    // Skip header detection inside strings for the same reason.
    if (!inStringArr[lineNum]) {
      const headerInfo = tryGetBlockHeader(document, lineNum);
      if (headerInfo) {
        const baseIndent = document.lineAt(
          headerInfo.startLine,
        ).firstNonWhitespaceCharacterIndex;

        stack.push({
          indent: baseIndent,
          startLine: headerInfo.startLine,
          colonPosition: headerInfo.colonPosition,
          headerEndLine: headerInfo.colonLine,
        });

        // Jump past the entire header so we don't re-process its lines.
        lineNum = headerInfo.colonLine + 1;
        continue;
      }
    }

    lineNum++;
  }

  // Flush any blocks still open — they end at the last line of the file.
  while (stack.length > 0) {
    const closedBlock = stack.pop()!;
    blocks.push(createBlock(document, closedBlock, document.lineCount - 1));
  }

  return blocks;
}
