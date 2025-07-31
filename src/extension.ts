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
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(
      debounce((e) => {
        if (vscode.window.activeTextEditor && e.document === vscode.window.activeTextEditor.document) {
          highlighter.invalidateBlockTree(); // Invalidate the tree
          highlighter.updateDecorations(vscode.window.activeTextEditor);
        }
      }, 100)
    ),
    vscode.window.onDidChangeTextEditorSelection((e) => {
      highlighter.resetSelectionState(e.textEditor);
      highlighter.updateDecorations(e.textEditor);
    }),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
            highlighter.invalidateBlockTree(); // Also invalidate when switching files
            highlighter.updateDecorations(editor);
        }
    })
  );
}

export function deactivate() {
  console.log("PyScope extension deactivated");
  highlighter.dispose();
}
