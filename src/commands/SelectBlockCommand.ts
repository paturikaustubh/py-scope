import * as vscode from "vscode";
import { Command } from "./Command"; // Base command abstract class
import { Highlighter } from "../decorations/Highlighter";

export class SelectBlockCommand extends Command {
  constructor(private highlighter: Highlighter) {
    super();
  }

  public register(): vscode.Disposable {
    return vscode.commands.registerCommand("pyScope.selectBlock", () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage("No active editor found.");
        return;
      }
      const blockRange = this.highlighter.getCurrentBlockRange(editor);
      if (blockRange) {
        editor.selection = new vscode.Selection(
          blockRange.start,
          blockRange.end
        );
        editor.revealRange(blockRange);
      } else {
        vscode.window.showInformationMessage(
          "No block found at the current cursor position."
        );
      }
    });
  }
}
