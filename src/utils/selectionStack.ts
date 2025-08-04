import * as vscode from "vscode";
import { CodeBlockNode } from "./BlockTree";

export interface SelectionState {
  selections: vscode.Selection[];
  selectedNode: CodeBlockNode | undefined;
}

export const selectionStack: SelectionState[] = [];