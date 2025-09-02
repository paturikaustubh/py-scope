import * as vscode from "vscode";
import { Command } from "./Command";
import { Highlighter } from "../decorations/Highlighter";
import { selectionStack } from "../utils/selectionStack";

export class SelectBlockCommand extends Command {
  constructor(private highlighter: Highlighter) {
    super();
  }

  public register(): vscode.Disposable {
    return vscode.commands.registerCommand("pyScope.selectBlock", () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        this.highlighter.lastSelectionTimestamp = Date.now();
        // Push the current state onto the stack before changing it
        selectionStack.push({
          selections: [...editor.selections],
          selectedNode: this.highlighter.selectedNode,
        });

        const range = this.highlighter.selectNextBlock(editor);
        if (range) {
          editor.selection = new vscode.Selection(range.start, range.end);
          editor.revealRange(range);
        } else {
          // If no new block is selected, pop the state we just pushed.
          selectionStack.pop();
        }
        this.highlighter.updateDecorations(editor);
      }
    });
  }
}
