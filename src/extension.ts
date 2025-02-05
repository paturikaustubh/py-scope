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
  let blockOpacity = config.get<number>("blockHighlightOpacity", 0.08);
  let firstLastOpacity = config.get<number>("firstLastLineOpacity", 0.2);

  if (!highlightColor || highlightColor.trim() === "") {
    highlightColor = "27, 153, 5";
    vscode.window.showWarningMessage(
      "Invalid color value provided. Using default color."
    );
  }

  // Validate opacity values (must be > 0 and ≤ 1)
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
    highlightDecoration: createBlockHighlight(highlightColor, blockOpacity),
    firstLineHighlight: createFirstLineHighlight(
      highlightColor,
      firstLastOpacity
    ),
    lastLineHighlight: createLastLineHighlight(
      highlightColor,
      firstLastOpacity
    ),
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

  // --- Color Change Command ---
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

        // Force immediate re-highlighting after color change
        currentBlockData = undefined;
        if (vscode.window.activeTextEditor) {
          updateAllDecorations();
        }
      }
    }
  );
  context.subscriptions.push(changeColorCommand);

  // --- Opacity Change Command ---
  const changeOpacityCommand = vscode.commands.registerCommand(
    "pyScope.changeOpacity",
    async () => {
      interface OpacityOption extends vscode.QuickPickItem {
        key: string;
        defaultValue: number; // Add a default value for each option
      }

      const opacityOptions: OpacityOption[] = [
        {
          label: "Block Highlight Opacity",
          key: "blockHighlightOpacity",
          defaultValue: 0.08, // Default value for block highlight
        },
        {
          label: "First and Last Line Opacity",
          key: "firstLastLineOpacity",
          defaultValue: 0.2, // Default value for first/last line
        },
      ];

      const selectedOption = await vscode.window.showQuickPick(opacityOptions, {
        placeHolder: "Select the opacity setting to change",
      });

      if (selectedOption) {
        const input = await vscode.window.showInputBox({
          prompt: `Enter a number (0 < opacity ≤ 1) for ${selectedOption.label}. Leave empty to use default (${selectedOption.defaultValue}).`,
          validateInput: (value: string) => {
            if (value.trim() === "") {
              return null; // Allow empty input for fallback
            }
            const num = parseFloat(value);
            if (isNaN(num) || num <= 0 || num > 1) {
              return "Please enter a valid number between 0 (exclusive) and 1 (inclusive).";
            }
            return null;
          },
        });

        if (input !== undefined) {
          let numValue: number;
          if (input.trim() === "") {
            // Fallback to default value if input is empty
            numValue = selectedOption.defaultValue;
          } else {
            numValue = parseFloat(input);
            if (isNaN(numValue) || numValue <= 0 || numValue > 1) {
              vscode.window.showErrorMessage(
                "Invalid opacity value. Must be a number between 0 (exclusive) and 1 (inclusive)."
              );
              return;
            }
          }

          const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
          await config.update(
            `${selectedOption.key}`,
            numValue,
            vscode.ConfigurationTarget.Global
          );
          vscode.window.showInformationMessage(
            `${selectedOption.label} updated to ${numValue}`
          );

          // Force immediate update
          currentBlockData = undefined;
          if (vscode.window.activeTextEditor) {
            updateAllDecorations();
          }
        }
      }
    }
  );
  context.subscriptions.push(changeOpacityCommand);

  // --- Configuration Change Listener ---
  const configListener = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration(CONFIG_SECTION)) {
      console.log("Configuration changed - updating decorations");
      // Dispose old decorations and reset cached block data
      disposeDecorations(state);
      currentBlockData = undefined;
      previousIndentation = undefined;
      // Create new decorations with updated settings
      state = createDecorations();
      // Force immediate update
      updateAllDecorations();
    }
  });
  state.disposables.push(configListener);

  // --- Update and Highlight Logic ---
  const updateAllDecorations = () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== "python") return;
    try {
      // (Re)parse blocks and re-highlight the current block.
      parsePythonBlocks(editor.document);
      // Always re-highlight the current block.
      highlightBlock(editor, editor.selection.active.line);
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
      lastLine - 1,
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

  // --- Event Listeners ---
  state.disposables.push(
    vscode.workspace.onDidChangeTextDocument(
      debounce(updateAllDecorations, DEBOUNCE_DELAY)
    ),
    vscode.window.onDidChangeTextEditorSelection(
      debounce((e) => handleCursorMove(e.textEditor), DEBOUNCE_DELAY)
    ),
    vscode.window.onDidChangeActiveTextEditor(updateAllDecorations)
  );

  // Initial update of decorations
  updateAllDecorations();
  context.subscriptions.push(new vscode.Disposable(() => deactivate()));
}

export function deactivate() {
  console.log("PyScope extension deactivated");
  disposeDecorations(state);
  state = undefined;
}
