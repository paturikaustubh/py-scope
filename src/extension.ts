import * as vscode from "vscode";
import { createBlockHighlight, createBlockBorder } from "./config/styles";
import { BlockAnalyzer } from "./blockAnalyzer";

const CONFIG_SECTION = "pyBraces";
const DEFAULT_HIGHLIGHT_COLOR = "hsla(210, 100%, 50%, 0.05)";
const DEFAULT_BORDER_COLOR = "hsla(210, 100%, 50%, 0.3)";

let blockAnalyzer: BlockAnalyzer;
let highlightDecoration: vscode.TextEditorDecorationType;
let borderDecoration: vscode.TextEditorDecorationType;
let disposables: vscode.Disposable[] = [];

export function activate(context: vscode.ExtensionContext) {
  console.log("PyBraces extension activated");

  // Initialize analyzer and decorations
  blockAnalyzer = new BlockAnalyzer();
  highlightDecoration = createBlockHighlight(DEFAULT_HIGHLIGHT_COLOR);
  borderDecoration = createBlockBorder(DEFAULT_BORDER_COLOR);

  // Register commands and event handlers
  disposables.push(
    vscode.workspace.onDidChangeTextDocument(debounce(updateDecorations, 100)),
    vscode.window.onDidChangeTextEditorSelection(
      debounce(updateDecorations, 50)
    ),
    vscode.window.onDidChangeActiveTextEditor(updateDecorations)
  );

  // Initial update
  updateDecorations();
}

function updateDecorations() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "python") {
    return;
  }

  // Clear existing decorations
  editor.setDecorations(highlightDecoration, []);
  editor.setDecorations(borderDecoration, []);

  // Get active block
  const activeBlock = blockAnalyzer.getActiveBlock(editor);
  if (!activeBlock) {
    return;
  }

  // Apply new decorations
  const highlightRange = new vscode.Range(
    activeBlock.openRange.start.line + 1,
    0,
    activeBlock.closeRange.end.line - 1,
    Number.MAX_SAFE_INTEGER
  );
  editor.setDecorations(highlightDecoration, [highlightRange]);

  const borderRange = new vscode.Range(
    activeBlock.openRange.start.line,
    0,
    activeBlock.closeRange.end.line,
    Number.MAX_SAFE_INTEGER
  );
  editor.setDecorations(borderDecoration, [borderRange]);
}

function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let timeout: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  }) as T;
}

export function deactivate() {
  console.log("PyBraces extension deactivated");
  disposables.forEach((d) => d.dispose());
  highlightDecoration.dispose();
  borderDecoration.dispose();
}
