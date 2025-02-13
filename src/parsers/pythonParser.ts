import * as vscode from "vscode";

export interface CodeBlock {
  openRange: vscode.Range;
  closeRange: vscode.Range;
  headerEndLine: number; // New property for multi-line headers
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
];

/**
 * Attempts to detect a block header that might span multiple lines.
 *
 * @param document The current text document.
 * @param startLine The line number where the potential header starts.
 * @returns An object with header info if a colon is found; otherwise, undefined.
 */
function tryGetBlockHeader(
  document: vscode.TextDocument,
  startLine: number
): { startLine: number; colonLine: number; colonPosition: number } | undefined {
  let headerLine = document.lineAt(startLine).text;
  let codePart = headerLine.split(/#.*/)[0].trim();
  // Ensure the line starts with one of the block keywords.
  const isKeyword = BLOCK_KEYWORDS.some((keyword) =>
    new RegExp(`^\\s*${keyword}\\b`).test(codePart)
  );
  if (!isKeyword) {
    return undefined;
  }
  // If a colon is present on the start line, return immediately.
  let colonIndex = headerLine.indexOf(":");
  if (colonIndex !== -1) {
    return { startLine, colonLine: startLine, colonPosition: colonIndex + 1 };
  }
  // Otherwise, accumulate lines until a colon is found.
  let currentLine = startLine;
  let accumulatedHeader = headerLine;
  while (currentLine < document.lineCount - 1) {
    currentLine++;
    const nextLineText = document.lineAt(currentLine).text;
    accumulatedHeader += nextLineText;
    colonIndex = nextLineText.indexOf(":");
    if (colonIndex !== -1) {
      return {
        startLine,
        colonLine: currentLine,
        colonPosition: colonIndex + 1,
      };
    }
    // Heuristic: if the next line is not indented more than the start line, assume the header did not continue.
    const baseIndent =
      document.lineAt(startLine).firstNonWhitespaceCharacterIndex;
    const nextIndent =
      document.lineAt(currentLine).firstNonWhitespaceCharacterIndex;
    if (nextIndent <= baseIndent) {
      break;
    }
  }
  return undefined;
}

export function parsePythonBlocks(document: vscode.TextDocument): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const stack: BlockStackItem[] = [];
  let lineNum = 0;
  while (lineNum < document.lineCount) {
    const line = document.lineAt(lineNum);
    if (line.isEmptyOrWhitespace) {
      lineNum++;
      continue;
    }
    const currentIndent = line.firstNonWhitespaceCharacterIndex;
    // Close any blocks that have ended.
    while (
      stack.length > 0 &&
      currentIndent <= stack[stack.length - 1].indent
    ) {
      const closedBlock = stack.pop()!;
      const endLine = lineNum - 1;
      blocks.push(createBlock(document, closedBlock, endLine));
    }
    // Check if this line (or a multi-line header) starts a block.
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
      // Skip the header lines.
      lineNum = headerInfo.colonLine + 1;
      continue;
    }
    lineNum++;
  }
  // Close any remaining open blocks.
  while (stack.length > 0) {
    const closedBlock = stack.pop()!;
    const endLine = document.lineCount - 1;
    blocks.push(createBlock(document, closedBlock, endLine));
  }
  return blocks;
}

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
