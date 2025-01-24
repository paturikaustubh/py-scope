import * as vscode from "vscode";

const globals = {
  generalBgOpacity: "0.08",
  firstLastBgOpacity: "0.2",
};

export function createBlockHighlight(
  color: string
): vscode.TextEditorDecorationType {
  return vscode.window.createTextEditorDecorationType({
    backgroundColor: `hsla(${color}, ${globals.generalBgOpacity})`,
    isWholeLine: true,
  });
}

export function createFirstLineHighlight(
  color: string
): vscode.TextEditorDecorationType {
  return vscode.window.createTextEditorDecorationType({
    backgroundColor: `hsla(${color}, ${globals.firstLastBgOpacity})`,
    isWholeLine: true,
  });
}

export function createLastLineHighlight(
  color: string
): vscode.TextEditorDecorationType {
  return vscode.window.createTextEditorDecorationType({
    backgroundColor: `hsla(${color}, ${globals.firstLastBgOpacity})`,
    isWholeLine: true,
  });
}
