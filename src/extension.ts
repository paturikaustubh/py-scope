import * as vscode from "vscode";
import { CodeBlock, parsePythonBlocks } from "./pythonParser";
import {
  createBlockHighlight,
  createFirstLineHighlight,
  createLastLineHighlight,
} from "./config/styles";

const CONFIG_SECTION = "pyScope";
const DEFAULT_COLOR = "0, 0%, 31%";
const ACTIVE_COLOR = "111, 100%, 31%";
const HIGHLIGHT_COLOR = "111, 94%, 31%";
const DEBOUNCE_DELAY = 100;

interface ExtensionState {
  highlightDecoration: vscode.TextEditorDecorationType;
  firstLineHighlight: vscode.TextEditorDecorationType;
  lastLineHighlight: vscode.TextEditorDecorationType;
  disposables: vscode.Disposable[];
}

let state: ExtensionState | undefined;

// Debounce utility
function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let timeout: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  }) as T;
}

export function activate(context: vscode.ExtensionContext) {
  console.log("PyScope extension activated");

  state = {
    highlightDecoration: createBlockHighlight(HIGHLIGHT_COLOR),
    firstLineHighlight: createFirstLineHighlight(ACTIVE_COLOR),
    lastLineHighlight: createLastLineHighlight(ACTIVE_COLOR),
    disposables: [],
  };

  const updateAllDecorations = () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== "python") {
      console.log("No active Python editor found");
      return;
    }

    console.log("Updating decorations for:", editor.document.fileName);
    try {
      const blocks = parsePythonBlocks(editor.document);
      console.log(`Found ${blocks.length} code blocks`);
      handleCursorMove(editor);
    } catch (error) {
      console.error("Error updating decorations:", error);
    }
  };

  function handleCursorMove(editor: vscode.TextEditor) {
    if (!state) {
      return;
    }

    const blocks = parsePythonBlocks(editor.document);
    const activeBlock = findInnerMostBlock(
      blocks,
      editor.selection.active.line
    );

    // Clear all decorations
    editor.setDecorations(state.highlightDecoration, []);
    editor.setDecorations(state.firstLineHighlight, []);
    editor.setDecorations(state.lastLineHighlight, []);

    if (activeBlock) {
      const startLine = activeBlock.openRange.start.line;
      const endLine = activeBlock.closeRange.end.line;

      // Highlight block body (lines after opener up to and including closer)
      let highlightRanges: vscode.Range[] = [];
      if (startLine < endLine) {
        highlightRanges.push(
          new vscode.Range(startLine + 1, 0, endLine, Number.MAX_SAFE_INTEGER)
        );
      }

      editor.setDecorations(state.highlightDecoration, highlightRanges);

      // Highlight first line
      const firstLineRange = new vscode.Range(
        activeBlock.openRange.start.line,
        0,
        activeBlock.openRange.start.line,
        Number.MAX_SAFE_INTEGER
      );
      editor.setDecorations(state.firstLineHighlight, [firstLineRange]);

      // Highlight last line
      const lastLineRange = new vscode.Range(
        activeBlock.closeRange.end.line,
        0,
        activeBlock.closeRange.end.line,
        Number.MAX_SAFE_INTEGER
      );
      editor.setDecorations(state.lastLineHighlight, [lastLineRange]);
    }
  }

  function findInnerMostBlock(
    blocks: CodeBlock[],
    cursorLine: number
  ): CodeBlock | undefined {
    // Find all blocks containing the cursor
    const containingBlocks = blocks.filter(
      (block) =>
        cursorLine >= block.openRange.start.line &&
        cursorLine <= block.closeRange.end.line
    );

    // Return the block with the smallest scope
    return containingBlocks.reduce((prev, current) => {
      if (!prev) {
        return current;
      }
      const prevSize = prev.closeRange.end.line - prev.openRange.start.line;
      const currentSize =
        current.closeRange.end.line - current.openRange.start.line;
      return currentSize < prevSize ? current : prev;
    }, undefined as CodeBlock | undefined);
  }

  // Register event handlers
  state.disposables.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(CONFIG_SECTION)) {
        console.log("Configuration changed - updating decorations");
        updateAllDecorations();
      }
    }),

    vscode.window.onDidChangeTextEditorSelection(
      debounce((e) => {
        if (e.textEditor.document.languageId === "python") {
          handleCursorMove(e.textEditor);
        }
      }, DEBOUNCE_DELAY)
    ),

    vscode.workspace.onDidChangeTextDocument(
      debounce(() => {
        updateAllDecorations();
      }, DEBOUNCE_DELAY)
    ),

    vscode.window.onDidChangeActiveTextEditor(updateAllDecorations)
  );

  // Initial update
  updateAllDecorations();
  context.subscriptions.push(new vscode.Disposable(() => deactivate()));
}

export function deactivate() {
  console.log("PyScope extension deactivated");
  if (state) {
    state.disposables.forEach((d) => d.dispose());
    state.highlightDecoration.dispose();
    state.firstLineHighlight.dispose();
    state.lastLineHighlight.dispose();
    state = undefined;
  }
}
