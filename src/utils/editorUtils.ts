import * as vscode from "vscode";

export function getLineIndentation(
  document: vscode.TextDocument,
  line: number,
): number {
  return document.lineAt(line).text.search(/\S|$/);
}
