import * as vscode from "vscode";
import { CodeBlockNode } from "./BlockTree";

/**
 * Snapshot of editor state at the moment the user pressed Ctrl+Alt+A.
 * Stored so Ctrl+Alt+Z can restore exactly where they were.
 */
export interface SelectionState {
  selections: vscode.Selection[];
  selectedNode: CodeBlockNode | undefined;
}

/**
 * Module-level stack that persists across SelectBlockCommand and
 * UndoBlockSelectionCommand calls within the same editing session.
 * It's cleared whenever the user breaks the selection chain (idle > 200 ms).
 */
export const selectionStack: SelectionState[] = [];
