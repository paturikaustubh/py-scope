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

function tryGetBlockHeader(
  document: vscode.TextDocument,
  startLine: number,
): { startLine: number; colonLine: number; colonPosition: number } | undefined {
  const firstLineText = document.lineAt(startLine).text;

  // Quick keyword check
  const firstLineCodePart = firstLineText.split(/#.*/)[0].trim();
  const isKeyword = BLOCK_KEYWORDS.some((keyword) =>
    new RegExp(`^${keyword}\\b`).test(firstLineCodePart),
  );
  if (!isKeyword) {
    return undefined;
  }

  let parenLevel = 0;
  let lineNum = startLine;

  while (lineNum < document.lineCount) {
    const lineText = document.lineAt(lineNum).text;

    let state: "NORMAL" | "S_QUOTE" | "D_QUOTE" = "NORMAL";
    let colonPos = -1;
    let localParenLevel = parenLevel;

    for (let i = 0; i < lineText.length; i++) {
      const c = lineText[i];
      if (state === "NORMAL") {
        if (c === "#") {
          break; // Rest is comment
        } else if (c === '"') {
          state = "D_QUOTE";
        } else if (c === "'") {
          state = "S_QUOTE";
        } else if ("([{".includes(c)) {
          localParenLevel++;
        } else if (")]}".includes(c)) {
          localParenLevel--;
        } else if (c === ":") {
          if (localParenLevel === 0) {
            colonPos = i;
          }
        }
      } else if (state === "S_QUOTE") {
        if (c === "\\") {
          i++; // Skip next
        } else if (c === "'") {
          state = "NORMAL";
        }
      } else if (state === "D_QUOTE") {
        if (c === "\\") {
          i++;
        } else if (c === '"') {
          state = "NORMAL";
        }
      }
    }

    parenLevel = localParenLevel;

    // Check inline single-line block (only on first line)
    // e.g. `if True: pass`
    if (lineNum === startLine && colonPos !== -1) {
      let hasBody = false;
      for (let j = colonPos + 1; j < lineText.length; j++) {
        if (lineText[j] === "#") {
          break;
        }
        if (lineText[j] !== " " && lineText[j] !== "\t") {
          hasBody = true;
          break;
        }
      }

      if (hasBody) {
        return { startLine, colonLine: startLine, colonPosition: colonPos + 1 };
      }
    }

    // Multi-line block detection. If colonPos is the last meaningful character.
    if (colonPos !== -1 && parenLevel === 0) {
      let hasBody = false;
      for (let j = colonPos + 1; j < lineText.length; j++) {
        if (lineText[j] === "#") {
          break;
        }
        if (lineText[j] !== " " && lineText[j] !== "\t") {
          hasBody = true;
          break;
        }
      }

      if (!hasBody) {
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
            document.lineAt(startLine).firstNonWhitespaceCharacterIndex
        ) {
          return undefined; // Not actually a block (no indented body)
        }

        return { startLine, colonLine: lineNum, colonPosition: colonPos + 1 };
      }
    }

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

function computeInStringArray(document: vscode.TextDocument): boolean[] {
  const inStringArr: boolean[] = new Array(document.lineCount).fill(false);
  const text = document.getText();

  let state:
    | "NORMAL"
    | "S_QUOTE"
    | "D_QUOTE"
    | "COMMENT"
    | "TRIPLE_S"
    | "TRIPLE_D" = "NORMAL";
  let lineIndex = 0;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (state === "TRIPLE_S" || state === "TRIPLE_D") {
      inStringArr[lineIndex] = true;
    }

    if (c === "\n") {
      if (state === "COMMENT" || state === "S_QUOTE" || state === "D_QUOTE") {
        state = "NORMAL";
      }
      lineIndex++;
      continue;
    }

    if (state === "NORMAL") {
      if (c === "#") {
        state = "COMMENT";
      } else if (c === '"') {
        if (text[i + 1] === '"' && text[i + 2] === '"') {
          state = "TRIPLE_D";
          inStringArr[lineIndex] = true;
          i += 2;
        } else {
          state = "D_QUOTE";
        }
      } else if (c === "'") {
        if (text[i + 1] === "'" && text[i + 2] === "'") {
          state = "TRIPLE_S";
          inStringArr[lineIndex] = true;
          i += 2;
        } else {
          state = "S_QUOTE";
        }
      }
    } else if (state === "S_QUOTE") {
      if (c === "\\") {
        i++;
      } else if (c === "'") {
        state = "NORMAL";
      }
    } else if (state === "D_QUOTE") {
      if (c === "\\") {
        i++;
      } else if (c === '"') {
        state = "NORMAL";
      }
    } else if (state === "TRIPLE_S") {
      if (c === "\\") {
        i++;
      } else if (c === "'" && text[i + 1] === "'" && text[i + 2] === "'") {
        state = "NORMAL";
        i += 2;
      }
    } else if (state === "TRIPLE_D") {
      if (c === "\\") {
        i++;
      } else if (c === '"' && text[i + 1] === '"' && text[i + 2] === '"') {
        state = "NORMAL";
        i += 2;
      }
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
