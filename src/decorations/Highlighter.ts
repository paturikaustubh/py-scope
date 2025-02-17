import * as vscode from "vscode";
import { parsePythonBlocks, CodeBlock } from "../parsers/pythonParser";
import {
  createBlockHighlight,
  createFirstLineHighlight,
  createLastLineHighlight,
} from "./styles";
import { getLineIndentation } from "../utils/editorUtils";

export class Highlighter {
  private readonly configSection = "pyScope";
  private decorations: {
    block: vscode.TextEditorDecorationType;
    firstLine: vscode.TextEditorDecorationType;
    lastLine: vscode.TextEditorDecorationType;
  };
  private currentBlockData?: {
    firstLine: number;
    lastLine: number;
    childBlocks: { firstLine: number; lastLine: number }[];
  };
  private previousIndentation?: number;
  private disposables: vscode.Disposable[] = [];

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
      lastLine: createLastLineHighlight(highlightColor, firstLastOpacity),
    };
  }

  private registerConfigurationListener() {
    const disposable = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(this.configSection)) {
        this.disposeDecorations();
        this.decorations = this.createDecorations();
        this.currentBlockData = undefined;
        this.previousIndentation = undefined;
        this.updateDecorations();
      }
    });
    this.disposables.push(disposable);
  }

  private disposeDecorations() {
    this.decorations.block.dispose();
    this.decorations.firstLine.dispose();
    this.decorations.lastLine.dispose();
  }

  public updateDecorations() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== "python") {
      return;
    }
    try {
      // Parse blocks and highlight based on the current cursor line.
      parsePythonBlocks(editor.document);
      this.highlightBlock(editor, editor.selection.active.line);
    } catch (error) {
      console.error("Error updating decorations:", error);
    }
  }

  public handleCursorMove(editor: vscode.TextEditor) {
    if (!editor) {
      return;
    }
    const currentLine = editor.selection.active.line;
    const currentIndentation = getLineIndentation(editor.document, currentLine);

    if (
      !this.currentBlockData ||
      currentLine < this.currentBlockData.firstLine ||
      currentLine > this.currentBlockData.lastLine ||
      currentIndentation !== this.previousIndentation
    ) {
      this.previousIndentation = currentIndentation;
      this.highlightBlock(editor, currentLine);
      return;
    }

    if (this.currentBlockData.childBlocks.length > 0) {
      for (const block of this.currentBlockData.childBlocks) {
        if (currentLine >= block.firstLine && currentLine <= block.lastLine) {
          this.highlightBlock(editor, currentLine);
          return;
        }
      }
    }
  }

  private highlightBlock(editor: vscode.TextEditor, currentLine: number) {
    const blocks = parsePythonBlocks(editor.document);
    const activeBlock = this.findInnerMostBlock(blocks, currentLine);

    if (activeBlock) {
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
        childBlocks: this.getChildBlocks(blocks, activeBlock),
      };
    } else {
      editor.setDecorations(this.decorations.block, []);
      editor.setDecorations(this.decorations.firstLine, []);
      editor.setDecorations(this.decorations.lastLine, []);
      this.currentBlockData = undefined;
    }
  }

  /**
   * Highlights the header and the block body separately.
   *
   * @param editor The active text editor.
   * @param headerStart The starting line of the header.
   * @param headerEnd The ending line of the header (line with the colon).
   * @param blockEnd The last line of the block.
   */
  private highlightRange(
    editor: vscode.TextEditor,
    headerStart: number,
    headerEnd: number,
    blockEnd: number
  ) {
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
    const headerRange = new vscode.Range(
      headerStart,
      0,
      headerEnd,
      Number.MAX_SAFE_INTEGER
    );
    editor.setDecorations(this.decorations.firstLine, [headerRange]);

    // Highlight the last line of the block.
    const lastLineRange = new vscode.Range(
      blockEnd,
      0,
      blockEnd,
      Number.MAX_SAFE_INTEGER
    );
    editor.setDecorations(this.decorations.lastLine, [lastLineRange]);
  }

  private getChildBlocks(allBlocks: CodeBlock[], parentBlock: CodeBlock) {
    return allBlocks
      .filter(
        (block) =>
          block.openRange.start.line > parentBlock.openRange.start.line &&
          block.closeRange.end.line <= parentBlock.closeRange.end.line
      )
      .map((block) => ({
        firstLine: block.openRange.start.line,
        lastLine: block.closeRange.end.line,
      }))
      .sort((a, b) => a.firstLine - b.firstLine);
  }

  private findInnerMostBlock(
    blocks: CodeBlock[],
    cursorLine: number
  ): CodeBlock | undefined {
    return blocks.reduce((prev, current) => {
      const inBlock =
        cursorLine >= current.openRange.start.line &&
        cursorLine <= current.closeRange.end.line;
      return inBlock &&
        (!prev ||
          current.closeRange.end.line - current.openRange.start.line <
            prev.closeRange.end.line - prev.openRange.start.line)
        ? current
        : prev;
    }, undefined as CodeBlock | undefined);
  }

  public getCurrentBlockRange(
    editor: vscode.TextEditor
  ): vscode.Range | undefined {
    const blocks = parsePythonBlocks(editor.document);
    const activeBlock = this.findInnerMostBlock(
      blocks,
      editor.selection.active.line
    );
    if (activeBlock) {
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

  public dispose() {
    this.disposeDecorations();
    this.disposables.forEach((d) => d.dispose());
  }
}
