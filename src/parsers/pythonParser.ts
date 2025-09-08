import * as vscode from "vscode";

export interface CodeBlock {
  openRange: vscode.Range;
  closeRange: vscode.Range;
  headerEndLine: number; // indicates the line with the colon in the header
  childBlocks?: { firstLine: number; lastLine: number }[];
}

interface BlockStackItem {
  indent: number;
  startLine: number;
  colonPosition: number;
  headerEndLine: number;
}

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

/**
 * Attempts to detect a block header that might span multiple lines.
 */
function tryGetBlockHeader(
  document: vscode.TextDocument,
  startLine: number
): { startLine: number; colonLine: number; colonPosition: number } | undefined {
  const firstLineText = document.lineAt(startLine).text;
  // Get the first line's text and its code part (ignoring comments).
  const codePart = firstLineText.split(/#.*/)[0].trim();
  const isKeyword = BLOCK_KEYWORDS.some((keyword) =>
    new RegExp(`^\\s*${keyword}\\b`).test(codePart)
  );
  if (!isKeyword) {
    return undefined;
  }
  const baseIndent =
    document.lineAt(startLine).firstNonWhitespaceCharacterIndex;

  // If the code portion of the first line contains ":", we’re done.
  if (codePart.includes(":")) {
    // Use the full line to determine the colon position.
    const colonPosition = firstLineText.lastIndexOf(":") + 1;
    return { startLine, colonLine: startLine, colonPosition };
  }

  // Otherwise, accumulate subsequent lines until we find a line whose code portion ends with ":".
  let currentLine = startLine;
  while (currentLine < document.lineCount - 1) {
    currentLine++;
    const line = document.lineAt(currentLine);
    const lineIndent = line.firstNonWhitespaceCharacterIndex;
    const lineText = line.text;
    const codePartLine = lineText.split(/#.*/)[0].trim();

    // If the line is not empty and its indentation is not greater than the base indentation,
    // it's not part of a multi-line header, so we stop.
    if (!line.isEmptyOrWhitespace && lineIndent <= baseIndent) {
      // ...and it's NOT the line that contains the colon we're looking for...
      if (!codePartLine.endsWith(":")) {
        // ...then it must be a new statement, so stop.
        break;
      }
    }

    if (codePartLine.endsWith(":")) {
      const colonPosition = lineText.lastIndexOf(":") + 1;
      return { startLine, colonLine: currentLine, colonPosition };
    }
  }
  return undefined;
}

/**
 * Counts occurrences of triple quotes (both """ and ''') in a line.
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
 * Pre-computes, for each line, whether that line is inside a triple-quoted string.
 * We toggle an "inString" flag whenever an odd number of triple quotes is encountered on a line.
 */
function computeInStringArray(document: vscode.TextDocument): boolean[] {
  const inStringArr: boolean[] = [];
  let inString = false;
  for (let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i).text;
    inStringArr.push(inString);
    const count = countTripleQuotes(line);
    // If the line contains an odd number of triple quotes, toggle the flag.
    if (count % 2 === 1) {
      inString = !inString;
    }
  }
  return inStringArr;
}

/**
 * Creates a CodeBlock from the given BlockStackItem and endLine.
 * Uses the last non‑empty line as the block's end.
 */
function createBlock(
  document: vscode.TextDocument,
  block: BlockStackItem,
  endLine: number
): CodeBlock {
  let lastContentLine = endLine;
  while (lastContentLine > block.startLine) {
    const line = document.lineAt(lastContentLine);
    if (!line.isEmptyOrWhitespace) {
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
      block.colonPosition
    ),
    closeRange: new vscode.Range(
      lastContentLine,
      line.text.length,
      lastContentLine,
      line.text.length
    ),
    headerEndLine: block.headerEndLine,
  };
}

/**
 * Parses Python blocks in the document.
 *
 * The key change here is that we first compute an array indicating which lines
 * are inside a triple-quoted string. Then, when checking for block closure (by indentation),
 * we ignore any line that is marked as being inside a string.
 */
export function parsePythonBlocks(document: vscode.TextDocument): CodeBlock[] {
  const inStringArr = computeInStringArray(document);
  const blocks: CodeBlock[] = [];
  const stack: BlockStackItem[] = [];
  let lineNum = 0;
  while (lineNum < document.lineCount) {
    const line = document.lineAt(lineNum);
    // If the line is empty, simply move on.
    if (line.isEmptyOrWhitespace) {
      lineNum++;
      continue;
    }
    // Only check for block closure if the current line is NOT inside a string.
    if (stack.length > 0 && !inStringArr[lineNum]) {
      const currentIndent = line.firstNonWhitespaceCharacterIndex;
      while (
        stack.length > 0 &&
        currentIndent <= stack[stack.length - 1].indent
      ) {
        const closedBlock = stack.pop()!;
        const endLine = lineNum - 1;
        blocks.push(createBlock(document, closedBlock, endLine));
      }
    }
    // Check if the current line (or a multi-line header) starts a new block.
    const headerInfo = tryGetBlockHeader(document, lineNum);
    if (headerInfo) {
      const baseIndent = document.lineAt(
        headerInfo.startLine
      ).firstNonWhitespaceCharacterIndex;
      stack.push({
        indent: baseIndent,
        startLine: headerInfo.startLine,
        colonPosition: headerInfo.colonPosition,
        headerEndLine: headerInfo.colonLine,
      });
      // Skip directly to the line after the header.
      lineNum = headerInfo.colonLine + 1;
      continue;
    }
    lineNum++;
  }
  // Close any remaining open blocks at the end of the document.
  while (stack.length > 0) {
    const closedBlock = stack.pop()!;
    const endLine = document.lineCount - 1;
    blocks.push(createBlock(document, closedBlock, endLine));
  }
  return blocks;
}
