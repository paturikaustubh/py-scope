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

let state: ExtensionState | undefined;

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
    highlightColor = "27, 153, 5"; // Fallback to default color
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
  console.log("PyScope extension activated");

  // Initialize decorations
  state = createDecorations();

  const changeColorCommand = vscode.commands.registerCommand(
    "pyScope.changeColor",
    async () => {
      interface ColorOption extends vscode.QuickPickItem {
        value: string;
      }

      const colorOptions: ColorOption[] = [
        { label: "Default", value: "27, 153, 5" },
        { label: "Red", value: "255, 69, 69" },
        { label: "Yellow", value: "243, 255, 69" },
        { label: "Blue", value: "69, 69, 255" },
        { label: "Custom...", value: "custom" },
      ];

      const selectedColor = await vscode.window.showQuickPick(colorOptions, {
        placeHolder: "Select a color or choose Custom...",
      });

      if (selectedColor) {
        let newColor = selectedColor.value;

        if (newColor === "custom") {
          const customColor = await vscode.window.showInputBox({
            prompt:
              "Enter RGB color (e.g., 255,0,0) or leave empty for default",
            placeHolder: "27, 153, 5",
            validateInput: (input) => {
              if (!input || input.trim() === "") {
                return null; // Allow empty input for fallback
              }
              const parts = input.split(",");
              if (parts.length !== 3) {
                return "Invalid format. Use R,G,B (e.g., 255,0,0).";
              }
              for (const part of parts) {
                const num = parseInt(part.trim(), 10);
                if (isNaN(num) || num < 0 || num > 255) {
                  return "Each value must be between 0 and 255.";
                }
              }
              return null; // No error
            },
          });

          if (customColor === undefined || customColor.trim() === "") {
            newColor = "27, 153, 5"; // Fallback to default color
          } else {
            newColor = customColor;
          }
        }

        const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
        await config.update(
          "blockHighlightColor",
          newColor,
          vscode.ConfigurationTarget.Global
        );

        vscode.window.showInformationMessage(
          `PyScope highlight color updated to: ${newColor}`
        );
      }
    }
  );

  context.subscriptions.push(changeColorCommand);

  const updateAllDecorations = () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== "python") return;

    try {
      const blocks = parsePythonBlocks(editor.document);
      handleCursorMove(editor);
    } catch (error) {
      console.error("Error updating decorations:", error);
    }
  };

  function handleCursorMove(editor: vscode.TextEditor) {
    if (!state) return;

    // Clear old decorations
    editor.setDecorations(state.highlightDecoration, []);
    editor.setDecorations(state.firstLineHighlight, []);
    editor.setDecorations(state.lastLineHighlight, []);

    const blocks = parsePythonBlocks(editor.document);
    const activeBlock = findInnerMostBlock(
      blocks,
      editor.selection.active.line
    );

    if (activeBlock) {
      const highlightRange = new vscode.Range(
        activeBlock.openRange.start.line + 1,
        0,
        activeBlock.closeRange.end.line,
        Number.MAX_SAFE_INTEGER
      );

      // Apply new decorations
      editor.setDecorations(state.highlightDecoration, [highlightRange]);
      editor.setDecorations(state.firstLineHighlight, [activeBlock.openRange]);
      editor.setDecorations(state.lastLineHighlight, [activeBlock.closeRange]);
    }
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

  // Configuration change handler
  const configListener = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration(CONFIG_SECTION)) {
      console.log("Configuration changed - updating decorations");

      // Dispose old decorations
      disposeDecorations(state);

      // Create new decorations with updated settings
      state = createDecorations();

      // Force immediate update
      updateAllDecorations();
    }
  });

  // Event listeners
  state.disposables = [
    configListener,
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
    vscode.window.onDidChangeActiveTextEditor(updateAllDecorations),
  ];

  // Initial update
  updateAllDecorations();
  context.subscriptions.push(new vscode.Disposable(() => deactivate()));
}

export function deactivate() {
  console.log("PyScope extension deactivated");
  disposeDecorations(state);
  state = undefined;
}
