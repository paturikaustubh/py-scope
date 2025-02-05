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
    if (!editor || editor.document.languageId !== "python") return;
    try {
      // Parse blocks and highlight based on the current cursor line.
      parsePythonBlocks(editor.document);
      this.highlightBlock(editor, editor.selection.active.line);
    } catch (error) {
      console.error("Error updating decorations:", error);
    }
  }

  public handleCursorMove(editor: vscode.TextEditor) {
    if (!editor) return;
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
      const adjustedLastLine = activeBlock.closeRange.end.line;
      this.highlightRange(
        editor,
        activeBlock.openRange.start.line,
        adjustedLastLine
      );

      this.currentBlockData = {
        firstLine: activeBlock.openRange.start.line,
        lastLine: adjustedLastLine,
        childBlocks: this.getChildBlocks(blocks, activeBlock),
      };
    } else {
      editor.setDecorations(this.decorations.block, []);
      editor.setDecorations(this.decorations.firstLine, []);
      editor.setDecorations(this.decorations.lastLine, []);
      this.currentBlockData = undefined;
    }
  }

  private highlightRange(
    editor: vscode.TextEditor,
    firstLine: number,
    lastLine: number
  ) {
    const highlightRange = new vscode.Range(
      firstLine + 1,
      0,
      lastLine - 1,
      Number.MAX_SAFE_INTEGER
    );
    editor.setDecorations(this.decorations.block, [highlightRange]);
    editor.setDecorations(this.decorations.firstLine, [
      new vscode.Range(firstLine, 0, firstLine, Number.MAX_SAFE_INTEGER),
    ]);
    editor.setDecorations(this.decorations.lastLine, [
      new vscode.Range(lastLine, 0, lastLine, Number.MAX_SAFE_INTEGER),
    ]);
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

  public dispose() {
    this.disposeDecorations();
    this.disposables.forEach((d) => d.dispose());
  }
}
