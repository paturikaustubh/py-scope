import * as vscode from "vscode";
import { parsePythonBlocks } from "./pythonParser";

interface CodeBlock {
  openRange: vscode.Range;
  closeRange: vscode.Range;
  type: "def" | "class" | "flow";
}

export class BlockAnalyzer {
  private syntaxCache = new WeakMap<vscode.TextDocument, CodeBlock[]>();
  private cursorHistory = new Map<string, number>();

  getBlocks(document: vscode.TextDocument): CodeBlock[] {
    if (this.syntaxCache.has(document)) {
      return this.syntaxCache.get(document)!;
    }

    const blocks = parsePythonBlocks(document);
    this.syntaxCache.set(document, blocks);
    return blocks;
  }

  getActiveBlock(editor: vscode.TextEditor): CodeBlock | undefined {
    const doc = editor.document;
    const cursorLine = editor.selection.active.line;
    const cacheKey = `${doc.uri.toString()}:${cursorLine}`;

    // Return cached result if cursor hasn't moved significantly
    if (this.cursorHistory.has(cacheKey)) {
      const prevLine = this.cursorHistory.get(cacheKey)!;
      if (Math.abs(cursorLine - prevLine) < 3) {
        return this.syntaxCache.get(doc)?.[cursorLine];
      }
    }

    const blocks = this.getBlocks(doc);
    let closestBlock: CodeBlock | undefined;
    let minDistance = Infinity;

    // Binary search for optimal performance (O(log n))
    let low = 0;
    let high = blocks.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const block = blocks[mid];

      if (
        cursorLine >= block.openRange.start.line &&
        cursorLine <= block.closeRange.end.line
      ) {
        // Check nested blocks
        const nested = blocks
          .slice(mid + 1)
          .find(
            (b) =>
              b.openRange.start.line > block.openRange.start.line &&
              b.closeRange.end.line < block.closeRange.end.line
          );

        closestBlock = nested || block;
        break;
      } else if (cursorLine < block.openRange.start.line) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    this.cursorHistory.set(cacheKey, cursorLine);
    return closestBlock;
  }
}
