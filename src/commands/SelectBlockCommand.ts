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
      if (!editor) {
        return;
      }

      this.highlighter.lastSelectionTimestamp = Date.now();

      // Snapshot the current state BEFORE changing anything so that
      // UndoBlockSelectionCommand can roll back to exactly this moment.
      selectionStack.push({
        selections: [...editor.selections],
        selectedNode: this.highlighter.selectedNode,
      });

      const range = this.highlighter.selectNextBlock(editor);
      if (range) {
        editor.selection = new vscode.Selection(range.start, range.end);
        editor.revealRange(range);
      } else {
        // selectNextBlock returned nothing (already at top / no block at cursor).
        // Roll back the snapshot we just pushed — no point keeping a no-op entry.
        selectionStack.pop();
      }

      this.highlighter.updateDecorations(editor);
    });
  }
}
