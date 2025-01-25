import * as vscode from "vscode";

export interface CodeBlock {
  openRange: vscode.Range;
  closeRange: vscode.Range;
}

interface BlockStackItem {
  indent: number;
  startLine: number;
  colonPosition: number;
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
];

export function parsePythonBlocks(document: vscode.TextDocument): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const stack: BlockStackItem[] = [];

  for (let lineNum = 0; lineNum < document.lineCount; lineNum++) {
    const line = document.lineAt(lineNum);
    if (line.isEmptyOrWhitespace) {
      continue;
    }

    const currentIndent = line.firstNonWhitespaceCharacterIndex;
    const lineText = line.text.trim();

    // Check if current line closes any open blocks
    while (
      stack.length > 0 &&
      currentIndent <= stack[stack.length - 1].indent
    ) {
      const closedBlock = stack.pop()!;
      const endLine = lineNum - 1;
      blocks.push(createBlock(document, closedBlock, endLine));
    }

    // Check if current line starts a new block
    if (isBlockStart(lineText)) {
      const colonIndex = line.text.indexOf(":");
      if (colonIndex === -1) {
        continue;
      }

      stack.push({
        indent: currentIndent,
        startLine: lineNum,
        colonPosition: colonIndex + 1,
      });
    }
  }

  // Close any remaining open blocks at end of file
  while (stack.length > 0) {
    const closedBlock = stack.pop()!;
    const endLine = document.lineCount - 1;
    blocks.push(createBlock(document, closedBlock, endLine));
  }

  return blocks;
}

function isBlockStart(lineText: string): boolean {
  // Split line into code and comment parts
  const codePart = lineText.split(/#.*/)[0].trim();
  if (!codePart.endsWith(":")) {
    return false;
  }
  // Check if the code part starts with a block keyword
  return BLOCK_KEYWORDS.some((keyword) =>
    new RegExp(`^\\s*${keyword}\\b`).test(codePart)
  );
}

function createBlock(
  document: vscode.TextDocument,
  block: BlockStackItem,
  endLine: number
): CodeBlock {
  // Adjust endLine to last non-empty line in block
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
  };
}
