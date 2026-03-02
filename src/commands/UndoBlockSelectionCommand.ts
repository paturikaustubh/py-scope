import * as vscode from "vscode";
import { Command } from "./Command";
import { Highlighter } from "../decorations/Highlighter";
import { selectionStack } from "../utils/selectionStack";

export class UndoBlockSelectionCommand extends Command {
  constructor(private highlighter: Highlighter) {
    super();
  }

  public register(): vscode.Disposable {
    return vscode.commands.registerCommand("pyScope.undoBlockSelection", () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      this.highlighter.lastSelectionTimestamp = Date.now();

      if (selectionStack.length > 0) {
        const prev = selectionStack.pop()!;

        // Restore the highlighter's internal node pointer FIRST — if we set
        // editor.selections before this, the selection-change event fires and
        // resetSelectionState() could clear the node we're about to restore.
        this.highlighter.selectedNode = prev.selectedNode;
        this.highlighter.selectionChainEnded = false;

        editor.selections = prev.selections;

        // Scroll to the restored selection so the user knows where they landed.
        const primary = prev.selections[0];
        if (primary) {
          editor.revealRange(
            new vscode.Range(primary.start, primary.end),
            vscode.TextEditorRevealType.InCenterIfOutsideViewport,
          );
        }
      } else {
        // Stack is empty — nothing to undo, just clean up any lingering state.
        this.highlighter.resetSelectionState(editor);
        vscode.window.showWarningMessage("No more selections to undo.");
      }

      this.highlighter.updateDecorations(editor);
    });
  }
}
