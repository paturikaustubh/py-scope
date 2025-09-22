import * as vscode from "vscode";
import { parsePythonBlocks, CodeBlock } from "../parsers/pythonParser";
import {
  createBlockHighlight,
  createFirstLastLineHighlight,
  createFirstLineHighlight,
  createLastLineHighlight,
  createSingleLineBlockHighlight,
} from "./styles";

import { selectionStack } from "../utils/selectionStack";
import { BlockTree, CodeBlockNode } from "../utils/BlockTree";

export class Highlighter {
  private readonly configSection = "pyScope";
  private decorations: {
    block: vscode.TextEditorDecorationType;
    firstLine: vscode.TextEditorDecorationType;
    firstLastLine: vscode.TextEditorDecorationType;
    lastLine: vscode.TextEditorDecorationType;
    singleLineBlock: vscode.TextEditorDecorationType;
  };
  private currentBlockData?: {
    firstLine: number;
    lastLine: number;
    childBlocks: { firstLine: number; lastLine: number }[];
  };
  private previousIndentation?: number;
  private disposables: vscode.Disposable[] = [];
  private blockTree: BlockTree | undefined;
  public selectedNode: CodeBlockNode | undefined;
  public lastSelectionTimestamp: number = 0;
  public selectionChainEnded: boolean = false;

  constructor() {
    this.decorations = this.createDecorations();
    this.registerConfigurationListener();
  }

  private createDecorations() {
    const config = vscode.workspace.getConfiguration(this.configSection);
    let highlightColor =
      config.get<string>("blockHighlightColor", "27, 153, 5") || "27, 153, 5";
    let blockOpacity = config.get<number>("blockHighlightOpacity", 0.08);
    let firstLastOpacity = config.get<number>("firstLastLineOpacity", 0.2);

    // Validate opacity values.
    if (blockOpacity <= 0 || blockOpacity > 1) {
      blockOpacity = 0.08;
      vscode.window.showWarningMessage(
        "Invalid block highlight opacity provided. Using default opacity."
      );
    }
    if (firstLastOpacity <= 0 || firstLastOpacity > 1) {
      firstLastOpacity = 0.2;
      vscode.window.showWarningMessage(
        "Invalid first/last line opacity provided. Using default opacity."
      );
    }

    return {
      block: createBlockHighlight(highlightColor, blockOpacity),
      firstLine: createFirstLineHighlight(highlightColor, firstLastOpacity),
      firstLastLine: createFirstLastLineHighlight(
        highlightColor,
        firstLastOpacity
      ),
      lastLine: createLastLineHighlight(highlightColor, firstLastOpacity),
      singleLineBlock: createSingleLineBlockHighlight(
        highlightColor,
        firstLastOpacity
      ),
    };
  }

  private registerConfigurationListener() {
    const disposable = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(this.configSection)) {
        this.disposeDecorations();
        this.decorations = this.createDecorations();
        this.currentBlockData = undefined;
        this.previousIndentation = undefined;
        this.updateDecorations(vscode.window.activeTextEditor);
      }
    });
    this.disposables.push(disposable);
  }

  private disposeDecorations() {
    this.decorations.block.dispose();
    this.decorations.firstLine.dispose();
    this.decorations.firstLastLine.dispose();
    this.decorations.lastLine.dispose();
    this.decorations.singleLineBlock.dispose();
  }

  public resetSelectionState(editor: vscode.TextEditor) {
    const now = Date.now();
    // Reset if enough time has passed (indicating a break in the command streak)
    // or if the selection is empty
    if (now - this.lastSelectionTimestamp > 200 || editor.selection.isEmpty) {
      if (selectionStack.length > 0) {
        selectionStack.length = 0; // Clear the stack
        this.updateDecorations(editor); // Update decorations to re-render highlighting
      }
      this.selectedNode = undefined;
      this.selectionChainEnded = false; // Allow a new chain to start
    }
  }

  public invalidateBlockTree() {
    this.blockTree = undefined;
  }

  private getBlockTree(document: vscode.TextDocument): BlockTree {
    if (!this.blockTree) {
      const blocks = parsePythonBlocks(document);
      this.blockTree = new BlockTree(blocks);
    }
    return this.blockTree;
  }

  public updateDecorations(editor?: vscode.TextEditor) {
    if (!editor || editor.document.languageId !== "python") {
      return;
    }

    if (selectionStack.length > 0) {
      this.clearAllDecorations(editor);
      this.currentBlockData = undefined; // Clear current block data
      return;
    }

    const cursorLine = editor.selection.active.line;
    const blockTree = this.getBlockTree(editor.document);
    const activeNode = blockTree.findNodeAtLine(cursorLine);

    const newBlockStartLine = activeNode?.block.openRange.start.line;
    const newBlockEndLine = activeNode?.block.closeRange.end.line;

    const currentBlockStartLine = this.currentBlockData?.firstLine;
    const currentBlockEndLine = this.currentBlockData?.lastLine;

    // If the block is the same (same start and end), do nothing.
    if (
      newBlockStartLine === currentBlockStartLine &&
      newBlockEndLine === currentBlockEndLine
    ) {
      return;
    }

    // If there is no active block, clear decorations and current block data
    if (!activeNode) {
      if (this.currentBlockData) {
        this.clearAllDecorations(editor);
        this.currentBlockData = undefined;
      }
      return;
    }

    try {
      // Parse blocks and highlight based on the current cursor line.
      this.highlightBlock(editor, cursorLine);
    } catch (error) {
      console.error("Error updating decorations:", error);
    }
  }

  public clearAllDecorations(editor: vscode.TextEditor) {
    editor.setDecorations(this.decorations.block, []);
    editor.setDecorations(this.decorations.firstLine, []);
    editor.setDecorations(this.decorations.firstLastLine, []);
    editor.setDecorations(this.decorations.lastLine, []);
    editor.setDecorations(this.decorations.singleLineBlock, []);
    this.currentBlockData = undefined;
  }

  private highlightBlock(editor: vscode.TextEditor, currentLine: number) {
    this.clearAllDecorations(editor);

    const blockTree = this.getBlockTree(editor.document);
    const activeNode = blockTree.findNodeAtLine(currentLine);

    if (activeNode && activeNode.block.openRange.start.line !== -1) {
      const activeBlock = activeNode.block;
      const blockEndLine = activeBlock.closeRange.end.line;
      // Use headerEndLine (from the parser) for the header decoration.
      this.highlightRange(
        editor,
        activeBlock.openRange.start.line, // header start (e.g., the "def" line)
        activeBlock.headerEndLine, // header end (line with the colon)
        blockEndLine // block end (last content line)
      );

      this.currentBlockData = {
        firstLine: activeBlock.openRange.start.line,
        lastLine: blockEndLine,
        childBlocks: this.getChildBlocks(blockTree.root, activeBlock),
      };
    } else {
      // If no active block, ensure currentBlockData is cleared
      this.currentBlockData = undefined;
    }
  }

  private highlightRange(
    editor: vscode.TextEditor,
    headerStart: number,
    headerEnd: number,
    blockEnd: number
  ) {
    // Handle single-line blocks separately.
    if (headerStart === blockEnd) {
      const singleLineRange = new vscode.Range(
        headerStart,
        0,
        blockEnd,
        Number.MAX_SAFE_INTEGER
      );
      editor.setDecorations(this.decorations.singleLineBlock, [
        singleLineRange,
      ]);

      // Ensure other decorations are not applied.
      editor.setDecorations(this.decorations.block, []);
      editor.setDecorations(this.decorations.firstLine, []);
      editor.setDecorations(this.decorations.firstLastLine, []);
      editor.setDecorations(this.decorations.lastLine, []);
      return;
    }

    // Highlight the block body (if any) with lower opacity.
    if (headerEnd + 1 <= blockEnd - 1) {
      const blockBodyRange = new vscode.Range(
        headerEnd + 1,
        0,
        blockEnd - 1,
        Number.MAX_SAFE_INTEGER
      );
      editor.setDecorations(this.decorations.block, [blockBodyRange]);
    } else {
      editor.setDecorations(this.decorations.block, []);
    }

    // Highlight the entire header with higher opacity.
    editor.setDecorations(this.decorations.firstLine, []);
    editor.setDecorations(this.decorations.firstLastLine, []);

    if (headerStart < headerEnd) {
      // Multi-line header: Apply firstLine to lines before the last header line
      const headerRange = new vscode.Range(
        headerStart,
        0,
        headerEnd - 1,
        Number.MAX_SAFE_INTEGER
      );
      editor.setDecorations(this.decorations.firstLine, [headerRange]);

      // Apply firstLastLine to the actual last line of the header
      const headerLastRange = new vscode.Range(
        headerEnd,
        0,
        headerEnd,
        Number.MAX_SAFE_INTEGER
      );
      editor.setDecorations(this.decorations.firstLastLine, [headerLastRange]);
    } else {
      // headerStart === headerEnd (single-line header)
      // Ensure firstLine is explicitly cleared for single-line headers
      editor.setDecorations(this.decorations.firstLine, []);

      // Single-line header: Only apply firstLastLine to this line
      const headerLastRange = new vscode.Range(
        headerStart, // or headerEnd, they are the same
        0,
        headerStart,
        Number.MAX_SAFE_INTEGER
      );
      editor.setDecorations(this.decorations.firstLastLine, [headerLastRange]);
    }

    // Highlight the last line of the block.
    const lastLineRange = new vscode.Range(
      blockEnd,
      0,
      blockEnd,
      Number.MAX_SAFE_INTEGER
    );
    editor.setDecorations(this.decorations.lastLine, [lastLineRange]);
  }

  private getChildBlocks(rootNode: CodeBlockNode, parentBlock: CodeBlock) {
    const parentNode = this.findNodeInTree(rootNode, parentBlock);
    if (parentNode) {
      return parentNode.children.map((child) => ({
        firstLine: child.block.openRange.start.line,
        lastLine: child.block.closeRange.end.line,
      }));
    }
    return [];
  }

  private findNodeInTree(
    node: CodeBlockNode,
    block: CodeBlock
  ): CodeBlockNode | undefined {
    if (node.block === block) {
      return node;
    }
    for (const child of node.children) {
      const found = this.findNodeInTree(child, block);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  public getCurrentBlockRange(
    editor: vscode.TextEditor
  ): vscode.Range | undefined {
    const blockTree = this.getBlockTree(editor.document);
    const activeNode = blockTree.findNodeAtLine(editor.selection.active.line);
    if (activeNode && activeNode.block.openRange.start.line !== -1) {
      const activeBlock = activeNode.block;
      const startLine = activeBlock.openRange.start.line;
      const endLine = activeBlock.closeRange.end.line;
      const endCol = editor.document.lineAt(endLine).text.length;
      return new vscode.Range(
        new vscode.Position(startLine, 0),
        new vscode.Position(endLine, endCol)
      );
    }
    return undefined;
  }

  public selectNextBlock(editor: vscode.TextEditor): vscode.Range | undefined {
    const blockTree = this.getBlockTree(editor.document);
    const { document, selection } = editor;

    // If a node isn't already selected, try to determine it from the editor's selection
    if (!this.selectedNode) {
      const nodeId = `${selection.start.line}-${selection.end.line}`;
      const node = blockTree.findNodeById(nodeId);
      if (node) {
        this.selectedNode = node;
      }
    }

    let nextNode: CodeBlockNode | undefined;

    // If selectionChainEnded is true, it means we've reached the top and should stop.
    if (this.selectionChainEnded) {
      vscode.window.showWarningMessage("No more parent blocks to select");
      return undefined;
    }

    if (this.selectedNode) {
      nextNode = this.selectedNode.parent || undefined;
      if (nextNode && nextNode === blockTree.root) {
        this.selectedNode = undefined; // Reset selectedNode when root is reached
        this.selectionChainEnded = true; // Mark chain as ended
        nextNode = undefined; // Ensure nextNode is also undefined
      }
    } else {
      // This branch is taken on the very first call, or after selectedNode has been reset to undefined.
      // Only find a new node at the cursor if the selection chain has NOT ended.
      if (!this.selectionChainEnded) {
        // This check is crucial here.
        nextNode = blockTree.findNodeAtLine(editor.selection.active.line);
      }
    }

    if (nextNode && nextNode.block.openRange.start.line !== -1) {
      this.selectedNode = nextNode;
      this.lastSelectionTimestamp = Date.now();
      this.selectionChainEnded = false; // A new chain has started or is continuing
      const { start } = nextNode.block.openRange;
      const endLine = nextNode.block.closeRange.end.line;
      const endCol = editor.document.lineAt(endLine).text.length;
      return new vscode.Range(
        new vscode.Position(start.line, 0),
        new vscode.Position(endLine, endCol)
      );
    } else {
      // This else block is reached if findNodeAtLine returns undefined (no block at cursor)
      // or if nextNode was explicitly set to undefined when reaching the root.
      vscode.window.showWarningMessage("No more parent blocks to select");
      this.selectedNode = undefined; // Ensure it's undefined if no nextNode is found
      this.selectionChainEnded = true; // Mark chain as ended
      return undefined;
    }
  }

  public dispose() {
    this.disposeDecorations();
    this.disposables.forEach((d) => d.dispose());
  }
}
