import * as vscode from "vscode";

export function createBlockHighlight(
  color: string
): vscode.TextEditorDecorationType {
  return vscode.window.createTextEditorDecorationType({
    backgroundColor: color,
    isWholeLine: true,
  });
}

export function createBlockBorder(
  color: string
): vscode.TextEditorDecorationType {
  return vscode.window.createTextEditorDecorationType({
    border: `1px solid ${color}`,
    borderRadius: "4px",
    backgroundColor: "transparent",
    isWholeLine: true,
  });
}
