import * as vscode from "vscode";
import { parsePythonBlocks } from "../parsers/pythonParser";
import {
  createBlockHighlight,
  createFirstLastLineHighlight,
  createFirstLineHighlight,
  createLastLineHighlight,
  createSingleLineBlockHighlight,
} from "./styles";
import { CONFIG_SECTION, DEFAULTS } from "../constants";
import { selectionStack } from "../utils/selectionStack";
import { BlockTree, CodeBlockNode } from "../utils/BlockTree";

export class Highlighter {
  // ── Decoration types ────────────────────────────────────────────────────────
  // Five visual layers, each targeting a different part of the active block:
  //   block          → body lines between the header and the last line
  //   firstLine      → header lines that are NOT the last header line (multi-line headers only)
  //   firstLastLine  → last line of the header  (higher opacity + bottom border)
  //   lastLine       → last content line of the block  (higher opacity + top border)
  //   singleLineBlock→ entire block when header == last line (e.g. `def f(): pass`)
  private decorations: {
    block: vscode.TextEditorDecorationType;
    firstLine: vscode.TextEditorDecorationType;
    firstLastLine: vscode.TextEditorDecorationType;
    lastLine: vscode.TextEditorDecorationType;
    singleLineBlock: vscode.TextEditorDecorationType;
  };

  // Tracks the start/end of the block that was highlighted last render cycle.
  // Used as a cheap "did anything change?" guard to skip redundant repaints.
  private currentBlockData?: {
    uri: string;
    firstLine: number;
    lastLine: number;
  };

  private disposables: vscode.Disposable[] = [];

  // Cached parse result per document URI — invalidated whenever the document content changes.
  // Cursor movement alone does NOT require a re-parse, so we hold onto this.
  private blockTrees = new Map<string, BlockTree>();

  // ── Selection state ─────────────────────────────────────────────────────────
  // Exposed as `public` so SelectBlockCommand / UndoBlockSelectionCommand can
  // read and mutate them directly without extra indirection.
  public selectedNode: CodeBlockNode | undefined;
  public lastSelectionTimestamp: number = 0;
  public selectionChainEnded: boolean = false;

  constructor() {
    this.decorations = this.createDecorations();
    this.registerConfigurationListener();
  }

  // ── Decoration lifecycle ─────────────────────────────────────────────────────

  /** Reads current config and builds all five decoration types. */
  private createDecorations() {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    let color =
      config.get<string>("blockHighlightColor", DEFAULTS.color) ||
      DEFAULTS.color;
    let blockOpacity = config.get<number>(
      "blockHighlightOpacity",
      DEFAULTS.blockOpacity,
    );
    let firstLastOpacity = config.get<number>(
      "firstLastLineOpacity",
      DEFAULTS.firstLastOpacity,
    );

    // Clamp bad values with a warning rather than silently breaking the UI.
    if (blockOpacity <= 0 || blockOpacity > 1) {
      blockOpacity = DEFAULTS.blockOpacity;
      vscode.window.showWarningMessage(
        "PyScope: invalid block highlight opacity — falling back to default.",
      );
    }
    if (firstLastOpacity <= 0 || firstLastOpacity > 1) {
      firstLastOpacity = DEFAULTS.firstLastOpacity;
      vscode.window.showWarningMessage(
        "PyScope: invalid first/last line opacity — falling back to default.",
      );
    }

    return {
      block: createBlockHighlight(color, blockOpacity),
      firstLine: createFirstLineHighlight(color, firstLastOpacity),
      firstLastLine: createFirstLastLineHighlight(color, firstLastOpacity),
      lastLine: createLastLineHighlight(color, firstLastOpacity),
      singleLineBlock: createSingleLineBlockHighlight(color, firstLastOpacity),
    };
  }

  /**
   * Listens for settings changes and hot-swaps the decoration types so the
   * editor reflects the new color/opacity without needing a restart.
   */
  private registerConfigurationListener() {
    const disposable = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(CONFIG_SECTION)) {
        this.disposeDecorations();
        this.decorations = this.createDecorations();
        // Force a full repaint with the new style.
        this.currentBlockData = undefined;
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

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Resets the block-selection chain if the user has moved on (idle > 200 ms
   * or the selection collapsed to a cursor).  Called from the selection-change
   * event in `extension.ts` before the debounced decoration update runs.
   */
  public resetSelectionState(editor: vscode.TextEditor) {
    const now = Date.now();
    if (now - this.lastSelectionTimestamp > 200 || editor.selection.isEmpty) {
      if (selectionStack.length > 0) {
        selectionStack.length = 0;
        this.updateDecorations(editor);
      }
      this.selectedNode = undefined;
      this.selectionChainEnded = false;
    }
  }

  /** Marks the cached block tree as stale for the given URI, or all if none provided. */
  public invalidateBlockTree(uri?: string) {
    if (uri) {
      this.blockTrees.delete(uri);
    } else {
      this.blockTrees.clear();
    }
  }

  /** Returns the cached tree, or parses the document fresh if the cache is cold. */
  private getBlockTree(document: vscode.TextDocument): BlockTree {
    const key = document.uri.toString();
    if (!this.blockTrees.has(key)) {
      this.blockTrees.set(key, new BlockTree(parsePythonBlocks(document)));
    }
    return this.blockTrees.get(key)!;
  }

  /**
   * Entry point called on every cursor move / document edit / tab switch.
   *
   * Guard order:
   *  1. Non-Python files → bail immediately.
   *  2. Active block selection (Ctrl+Alt+A) → clear highlights and wait.
   *  3. Same block as last time → no-op (the most common case when just typing).
   *  4. No block at cursor → clear highlights if something was shown before.
   *  5. Otherwise → repaint.
   */
  public updateDecorations(editor?: vscode.TextEditor) {
    if (!editor || editor.document.languageId !== "python") {
      return;
    }

    // While the user is expanding selections (Ctrl+Alt+A), don't overlay highlights.
    if (selectionStack.length > 0) {
      this.clearAllDecorations(editor);
      this.currentBlockData = undefined;
      return;
    }

    const cursorLine = editor.selection.active.line;
    const blockTree = this.getBlockTree(editor.document);
    const activeNode = blockTree.findNodeAtLine(cursorLine);

    const newStart = activeNode?.block.openRange.start.line;
    const newEnd = activeNode?.block.closeRange.end.line;

    const uri = editor.document.uri.toString();

    // Short-circuit: cursor is still inside the same block, nothing to redraw.
    if (
      this.currentBlockData?.uri === uri &&
      newStart === this.currentBlockData?.firstLine &&
      newEnd === this.currentBlockData?.lastLine
    ) {
      return;
    }

    if (!activeNode) {
      if (this.currentBlockData?.uri === uri || this.currentBlockData) {
        this.clearAllDecorations(editor);
        this.currentBlockData = undefined;
      }
      return;
    }

    try {
      this.highlightBlock(editor, cursorLine);
    } catch (error) {
      console.error("PyScope: error updating decorations:", error);
    }
  }

  /** Removes all active decorations from the editor. */
  public clearAllDecorations(editor: vscode.TextEditor) {
    editor.setDecorations(this.decorations.block, []);
    editor.setDecorations(this.decorations.firstLine, []);
    editor.setDecorations(this.decorations.firstLastLine, []);
    editor.setDecorations(this.decorations.lastLine, []);
    editor.setDecorations(this.decorations.singleLineBlock, []);
    this.currentBlockData = undefined;
  }

  // ── Highlight logic ───────────────────────────────────────────────────────────

  /** Finds the block at `currentLine` and applies the appropriate decorations. */
  private highlightBlock(editor: vscode.TextEditor, currentLine: number) {
    this.clearAllDecorations(editor);

    const blockTree = this.getBlockTree(editor.document);
    const activeNode = blockTree.findNodeAtLine(currentLine);

    if (activeNode && activeNode.block.openRange.start.line !== -1) {
      const { openRange, closeRange, headerEndLine } = activeNode.block;
      const blockEndLine = closeRange.end.line;

      this.highlightRange(
        editor,
        openRange.start.line,
        headerEndLine,
        blockEndLine,
      );

      this.currentBlockData = {
        uri: editor.document.uri.toString(),
        firstLine: openRange.start.line,
        lastLine: blockEndLine,
      };
    } else {
      this.currentBlockData = undefined;
    }
  }

  /**
   * Applies the five decoration types to the correct line ranges.
   *
   * Three structural cases:
   *
   *   A) headerStart === blockEnd   → single-line block (`def f(): pass`)
   *        singleLineBlock on that one line
   *
   *   B) headerStart === headerEnd  → single-line header, multi-line body
   *        firstLastLine on headerStart
   *        block on [headerEnd+1 .. blockEnd-1]
   *        lastLine on blockEnd
   *
   *   C) headerStart < headerEnd    → multi-line header (e.g. long def with many params)
   *        firstLine on [headerStart .. headerEnd-1]
   *        firstLastLine on headerEnd
   *        block on [headerEnd+1 .. blockEnd-1]
   *        lastLine on blockEnd
   */
  private highlightRange(
    editor: vscode.TextEditor,
    headerStart: number,
    headerEnd: number,
    blockEnd: number,
  ) {
    // ── Case A: entire block fits on one line ─────────────────────────────────
    if (headerStart === blockEnd) {
      editor.setDecorations(this.decorations.singleLineBlock, [
        new vscode.Range(headerStart, 0, blockEnd, Number.MAX_SAFE_INTEGER),
      ]);
      editor.setDecorations(this.decorations.block, []);
      editor.setDecorations(this.decorations.firstLine, []);
      editor.setDecorations(this.decorations.firstLastLine, []);
      editor.setDecorations(this.decorations.lastLine, []);
      return;
    }

    // ── Body (lines between the header and the last line) ─────────────────────
    if (headerEnd + 1 <= blockEnd - 1) {
      editor.setDecorations(this.decorations.block, [
        new vscode.Range(
          headerEnd + 1,
          0,
          blockEnd - 1,
          Number.MAX_SAFE_INTEGER,
        ),
      ]);
    } else {
      editor.setDecorations(this.decorations.block, []);
    }

    // ── Header decoration ─────────────────────────────────────────────────────
    editor.setDecorations(this.decorations.singleLineBlock, []);

    if (headerStart < headerEnd) {
      // Case C: multi-line header — shade the lines before the colon line
      editor.setDecorations(this.decorations.firstLine, [
        new vscode.Range(
          headerStart,
          0,
          headerEnd - 1,
          Number.MAX_SAFE_INTEGER,
        ),
      ]);
    } else {
      // Case B: single-line header — firstLine decoration not needed
      editor.setDecorations(this.decorations.firstLine, []);
    }

    // The colon line always gets firstLastLine (bottom border marks the header/body boundary).
    editor.setDecorations(this.decorations.firstLastLine, [
      new vscode.Range(headerEnd, 0, headerEnd, Number.MAX_SAFE_INTEGER),
    ]);

    // ── Last line ─────────────────────────────────────────────────────────────
    editor.setDecorations(this.decorations.lastLine, [
      new vscode.Range(blockEnd, 0, blockEnd, Number.MAX_SAFE_INTEGER),
    ]);
  }

  // ── Block selection (Ctrl+Alt+A) ──────────────────────────────────────────────

  /**
   * Selects the innermost block at the cursor on the first call, then walks
   * up to parent blocks on subsequent calls (until reaching the document root).
   */
  public selectNextBlock(editor: vscode.TextEditor): vscode.Range | undefined {
    const blockTree = this.getBlockTree(editor.document);

    // If the editor's current selection already matches a known node (e.g. after
    // an undo), re-anchor to it before continuing the chain upward.
    if (!this.selectedNode) {
      const nodeId = `${editor.selection.start.line}-${editor.selection.end.line}`;
      const node = blockTree.findNodeById(nodeId);
      if (node) {
        this.selectedNode = node;
      }
    }

    if (this.selectionChainEnded) {
      vscode.window.showWarningMessage("No more parent blocks to select");
      return undefined;
    }

    let nextNode: CodeBlockNode | undefined;

    if (this.selectedNode) {
      // Walk one step up the tree.
      nextNode = this.selectedNode.parent || undefined;
      if (nextNode && nextNode === blockTree.root) {
        // Reached the synthetic root — nowhere left to go.
        this.selectedNode = undefined;
        this.selectionChainEnded = true;
        nextNode = undefined;
      }
    } else {
      // First call: find the innermost block at the cursor position.
      if (!this.selectionChainEnded) {
        nextNode = blockTree.findNodeAtLine(editor.selection.active.line);
      }
    }

    if (nextNode && nextNode.block.openRange.start.line !== -1) {
      this.selectedNode = nextNode;
      this.lastSelectionTimestamp = Date.now();
      this.selectionChainEnded = false;

      const endLine = nextNode.block.closeRange.end.line;
      const endCol = editor.document.lineAt(endLine).text.length;
      return new vscode.Range(
        new vscode.Position(nextNode.block.openRange.start.line, 0),
        new vscode.Position(endLine, endCol),
      );
    } else {
      vscode.window.showWarningMessage("No more parent blocks to select");
      this.selectedNode = undefined;
      this.selectionChainEnded = true;
      return undefined;
    }
  }

  /** Disposes all decoration types and internal listeners. */
  public dispose() {
    this.disposeDecorations();
    this.disposables.forEach((d) => d.dispose());
  }
}
