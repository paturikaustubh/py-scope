import * as vscode from "vscode";
import { Command } from "./Command";
import { selectionStack } from "../utils/selectionStack";
import { Highlighter } from "../decorations/Highlighter";

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
        const previousState = selectionStack.pop();
        if (previousState) {
          // Restore the highlighter's state FIRST
          this.highlighter.selectedNode = previousState.selectedNode;
          this.highlighter.selectionChainEnded = false; // Allow new selections

          // Then restore the selection in the editor
          editor.selections = previousState.selections;

          // Reveal the primary selection
          const primarySelection = previousState.selections[0];
          if (primarySelection) {
            editor.revealRange(
              new vscode.Range(primarySelection.start, primarySelection.end),
              vscode.TextEditorRevealType.InCenterIfOutsideViewport,
            );
          }
        }
      } else {
        // If the stack is empty, reset the highlighter's selection state
        this.highlighter.resetSelectionState(editor);
        vscode.window.showWarningMessage("No more selections to undo.");
      }
    });
  }
}
