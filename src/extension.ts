import * as vscode from "vscode";
import { CodeBlock, parsePythonBlocks } from "./pythonParser";
import {
  createBlockHighlight,
  createFirstLineHighlight,
  createLastLineHighlight,
} from "./config/styles";

const CONFIG_SECTION = "pyScope";
const DEBOUNCE_DELAY = 100;

interface ExtensionState {
  highlightDecoration: vscode.TextEditorDecorationType;
  firstLineHighlight: vscode.TextEditorDecorationType;
  lastLineHighlight: vscode.TextEditorDecorationType;
  disposables: vscode.Disposable[];
}
interface BlockMetadata {
  firstLine: number;
  lastLine: number;
  childBlocks: {
    firstLine: number;
    lastLine: number;
  }[];
}

let state: ExtensionState | undefined;
let currentBlockData: BlockMetadata | undefined = undefined;
let previousIndentation: number | undefined = undefined;

function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let timeout: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  }) as T;
}

function createDecorations(): ExtensionState {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  let highlightColor = config.get<string>("blockHighlightColor", "27, 153, 5");

  if (!highlightColor || highlightColor.trim() === "") {
    highlightColor = "27, 153, 5";
    vscode.window.showWarningMessage(
      "Invalid color value provided. Using default color."
    );
  }

  return {
    highlightDecoration: createBlockHighlight(highlightColor),
    firstLineHighlight: createFirstLineHighlight(highlightColor),
    lastLineHighlight: createLastLineHighlight(highlightColor),
    disposables: [],
  };
}

function disposeDecorations(state: ExtensionState | undefined) {
  if (state) {
    state.highlightDecoration.dispose();
    state.firstLineHighlight.dispose();
    state.lastLineHighlight.dispose();
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log("PyScope", "PyScope extension activated");
  state = createDecorations();

  const updateAllDecorations = () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== "python") return;
    try {
      parsePythonBlocks(editor.document);
      handleCursorMove(editor);
    } catch (error) {
      console.error("Error updating decorations:", error);
    }
  };

  function handleCursorMove(editor: vscode.TextEditor) {
    if (!state) return;
    const currentLine = editor.selection.active.line;
    const currentIndentation = getLineIndentation(editor.document, currentLine);

    if (
      !currentBlockData ||
      currentLine < currentBlockData.firstLine ||
      currentLine > currentBlockData.lastLine ||
      currentIndentation !== previousIndentation
    ) {
      previousIndentation = currentIndentation;
      highlightBlock(editor, currentLine);
      return;
    }

    if (currentBlockData.childBlocks.length > 0) {
      for (const block of currentBlockData.childBlocks) {
        if (currentLine >= block.firstLine && currentLine <= block.lastLine) {
          highlightBlock(editor, currentLine);
          return;
        }
      }
    }
  }

  function highlightBlock(editor: vscode.TextEditor, currentLine: number) {
    const blocks = parsePythonBlocks(editor.document);
    const activeBlock = findInnerMostBlock(blocks, currentLine);

    if (activeBlock) {
      let adjustedLastLine = activeBlock.closeRange.end.line;
      highlightRange(
        editor,
        activeBlock.openRange.start.line,
        adjustedLastLine
      );

      currentBlockData = {
        firstLine: activeBlock.openRange.start.line,
        lastLine: adjustedLastLine,
        childBlocks: getChildBlocks(blocks, activeBlock),
      };
    } else {
      if (state) {
        editor.setDecorations(state.highlightDecoration, []);
        editor.setDecorations(state.firstLineHighlight, []);
        editor.setDecorations(state.lastLineHighlight, []);
      }
      currentBlockData = undefined;
    }
  }

  function highlightRange(
    editor: vscode.TextEditor,
    firstLine: number,
    lastLine: number
  ) {
    if (!state) return;

    const highlightRange = new vscode.Range(
      firstLine + 1,
      0,
      lastLine,
      Number.MAX_SAFE_INTEGER
    );
    editor.setDecorations(state.highlightDecoration, [highlightRange]);
    editor.setDecorations(state.firstLineHighlight, [
      new vscode.Range(firstLine, 0, firstLine, Number.MAX_SAFE_INTEGER),
    ]);
    editor.setDecorations(state.lastLineHighlight, [
      new vscode.Range(lastLine, 0, lastLine, Number.MAX_SAFE_INTEGER),
    ]);
  }

  function getChildBlocks(allBlocks: CodeBlock[], parentBlock: CodeBlock) {
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

  function findInnerMostBlock(
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

  function getLineIndentation(
    document: vscode.TextDocument,
    line: number
  ): number {
    return document.lineAt(line).text.search(/\S|$/);
  }

  state.disposables = [
    vscode.workspace.onDidChangeTextDocument(
      debounce(updateAllDecorations, DEBOUNCE_DELAY)
    ),
    vscode.window.onDidChangeTextEditorSelection(
      debounce((e) => handleCursorMove(e.textEditor), DEBOUNCE_DELAY)
    ),
    vscode.window.onDidChangeActiveTextEditor(updateAllDecorations),
  ];

  updateAllDecorations();
  context.subscriptions.push(new vscode.Disposable(() => deactivate()));
}

export function deactivate() {
  console.log("PyScope", "PyScope extension deactivated");
  disposeDecorations(state);
  state = undefined;
}
