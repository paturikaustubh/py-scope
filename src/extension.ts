import * as vscode from "vscode";
import { debounce } from "./utils/debounce";
import { Highlighter } from "./decorations/Highlighter";
import { ChangeColorCommand } from "./commands/ChangeColorCommand";
import { ChangeOpacityCommand } from "./commands/ChangeOpacityCommand";

let highlighter: Highlighter;

export function activate(context: vscode.ExtensionContext) {
  console.log("PyScope extension activated");

  // Create our Highlighter instance (handles decorations and parsing)
  highlighter = new Highlighter();

  // Instantiate our command objects.
  const commands = [
    new ChangeColorCommand(highlighter),
    new ChangeOpacityCommand(highlighter),
  ];

  // Register commands by calling their register method.
  commands.forEach((command) => {
    context.subscriptions.push(command.register());
  });

  // Register event listeners using the debounce utility.
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
