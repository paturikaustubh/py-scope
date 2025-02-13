import * as vscode from "vscode";
import { debounce } from "./utils/debounce";
import { Highlighter } from "./decorations/Highlighter";
import { ChangeColorCommand } from "./commands/ChangeColorCommand";
import { ChangeOpacityCommand } from "./commands/ChangeOpacityCommand";
import { SelectBlockCommand } from "./commands/SelectBlockCommand";

let highlighter: Highlighter;

export function activate(context: vscode.ExtensionContext) {
  console.log("PyScope extension activated");

  // Create our Highlighter instance.
  highlighter = new Highlighter();

  // Instantiate our command objects.
  const commands = [
    new ChangeColorCommand(highlighter),
    new ChangeOpacityCommand(highlighter),
    new SelectBlockCommand(highlighter), // new command added here
  ];

  // Register all commands.
  commands.forEach((command) => {
    context.subscriptions.push(command.register());
  });

  // Register event listeners.
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(
      debounce(() => highlighter.updateDecorations(), 100)
    ),
    vscode.window.onDidChangeTextEditorSelection(
      debounce((e) => highlighter.handleCursorMove(e.textEditor), 100)
    ),
    vscode.window.onDidChangeActiveTextEditor(() =>
      highlighter.updateDecorations()
    )
  );
}

export function deactivate() {
  console.log("PyScope extension deactivated");
  highlighter.dispose();
}
