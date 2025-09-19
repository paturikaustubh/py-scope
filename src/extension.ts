import * as vscode from "vscode";
import { debounce } from "./utils/debounce";
import { Highlighter } from "./decorations/Highlighter";
import { ChangeColorCommand } from "./commands/ChangeColorCommand";
import { ChangeOpacityCommand } from "./commands/ChangeOpacityCommand";
import { SelectBlockCommand } from "./commands/SelectBlockCommand";
import { UndoBlockSelectionCommand } from "./commands/UndoBlockSelectionCommand";

let highlighter: Highlighter;

export function activate(context: vscode.ExtensionContext) {
  console.log("PyScope extension activated");

  // Create our Highlighter instance.
  highlighter = new Highlighter();

  // Instantiate our command objects.
  const commands = [
    new ChangeColorCommand(context, highlighter),
    new ChangeOpacityCommand(highlighter),
    new SelectBlockCommand(highlighter),
    new UndoBlockSelectionCommand(highlighter),
  ];

  // Register all commands.
  commands.forEach((command) => {
    context.subscriptions.push(command.register());
  });

  // Register event listeners.
  const updateDecorations = (editor: vscode.TextEditor) => {
    highlighter.invalidateBlockTree();
    highlighter.updateDecorations(editor);
  };

  const debouncedUpdate = debounce(updateDecorations, 100);

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (
        vscode.window.activeTextEditor &&
        e.document === vscode.window.activeTextEditor.document
      ) {
        // If there's more than one change, it's likely a complex action like moving lines.
        // In this case, update synchronously to prevent smearing, accepting a brief flicker.
        if (e.contentChanges.length > 1) {
          highlighter.clearAllDecorations(vscode.window.activeTextEditor);
          updateDecorations(vscode.window.activeTextEditor);
        } else {
          // For normal typing, use a debounce to prevent performance issues and flickering.
          debouncedUpdate(vscode.window.activeTextEditor);
        }
      }
    }),
    vscode.window.onDidChangeTextEditorSelection((e) => {
      if (e.textEditor) {
        const now = Date.now();
        if (now - highlighter.lastSelectionTimestamp > 100) {
          highlighter.resetSelectionState(e.textEditor);
        }
        debouncedUpdate(e.textEditor);
      }
    }),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        debouncedUpdate(editor);
      }
    })
  );
}

export function deactivate() {
  console.log("PyScope extension deactivated");
  highlighter.dispose();
}
