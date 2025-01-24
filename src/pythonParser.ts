import * as vscode from "vscode";

interface BlockContext {
  startLine: number;
  startCol: number;
  indentLevel: number;
  type: "def" | "class" | "flow";
}

export interface CodeBlock {
  openRange: vscode.Range;
  closeRange: vscode.Range;
  type: "def" | "class" | "flow";
}

export function parsePythonBlocks(document: vscode.TextDocument): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const blockStack: BlockContext[] = [];
  let currentIndent = -1;
  let pendingColon = false;
  let lineContinuation = false;

  for (let lineNum = 0; lineNum < document.lineCount; lineNum++) {
    const line = document.lineAt(lineNum);
    if (line.isEmptyOrWhitespace && !pendingColon) {
      continue;
    }

    const text = line.text;
    const lineIndent = line.firstNonWhitespaceCharacterIndex;
    const trimmed = text.trim();

    // Handle line continuation characters
    lineContinuation =
      text.endsWith("\\") ||
      (text.match(/[(\[{]/g) || []).length >
        (text.match(/[)\]}]/g) || []).length;

    // Detect block starters
    if (!lineContinuation && !pendingColon) {
      const firstWord = trimmed.split(/\s+/)[0];
      if (
        [
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
        ].includes(firstWord)
      ) {
        pendingColon = true;
      }
    }

    // Find actual colon position
    if (pendingColon || lineContinuation) {
      const colonIndex = text.indexOf(
        ":",
        line.firstNonWhitespaceCharacterIndex
      );
      if (colonIndex > -1 && !isInsideBrackets(text, colonIndex)) {
        pendingColon = false;
        lineContinuation = false;

        // Calculate true indentation level
        const trueIndent =
          text.slice(0, colonIndex).match(/^\s*/)?.[0].length || 0;

        // Close parent blocks if needed
        while (
          blockStack.length > 0 &&
          trueIndent <= blockStack[blockStack.length - 1].indentLevel
        ) {
          const closedBlock = blockStack.pop()!;
          blocks.push(createBlock(document, closedBlock, lineNum - 1));
        }

        // Push new block context
        blockStack.push({
          startLine: lineNum,
          startCol: colonIndex + 1,
          indentLevel: trueIndent,
          type:
            trimmed.startsWith("def") || trimmed.startsWith("class")
              ? (trimmed.split(" ")[0] as "def" | "class")
              : "flow",
        });
      }
    }

    // Update current indent tracking
    if (!lineContinuation) {
      currentIndent = lineIndent;
    }
  }

  // Close remaining blocks
  while (blockStack.length > 0) {
    const block = blockStack.pop()!;
    blocks.push(createBlock(document, block, document.lineCount - 1));
  }

  return blocks;
}

function isInsideBrackets(text: string, index: number): boolean {
  const before = text.slice(0, index);
  const parenBalance =
    (before.match(/\(/g) || []).length - (before.match(/\)/g) || []).length;
  const braceBalance =
    (before.match(/\{/g) || []).length - (before.match(/\}/g) || []).length;
  const bracketBalance =
    (before.match(/\[/g) || []).length - (before.match(/\]/g) || []).length;

  return parenBalance > 0 || braceBalance > 0 || bracketBalance > 0;
}

function createBlock(
  document: vscode.TextDocument,
  block: BlockContext,
  endLine: number
): CodeBlock {
  const endLineText = document.lineAt(endLine).text;
  const endChar = endLineText.length;

  return {
    openRange: new vscode.Range(
      block.startLine,
      block.startCol,
      block.startLine,
      block.startCol
    ),
    closeRange: new vscode.Range(endLine, endChar, endLine, endChar),
    type: block.type,
  };
}
