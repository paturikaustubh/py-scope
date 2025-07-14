import * as vscode from "vscode";
import { Command } from "./Command";
import { Highlighter } from "../decorations/Highlighter";

export class SelectBlockCommand extends Command {
  constructor(private highlighter: Highlighter) {
    super();
  }

  public register(): vscode.Disposable {
    return vscode.commands.registerCommand("pyScope.selectBlock", () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const range = this.highlighter.selectNextBlock(editor);
        if (range) {
          editor.selection = new vscode.Selection(range.start, range.end);
          editor.revealRange(range);
        }
      }
    });
  }
}
