import * as vscode from "vscode";

export function createBlockHighlight(
  color: string,
  opacity: number
): vscode.TextEditorDecorationType {
  const bgColor = `rgba(${color}, ${opacity})`;
  return vscode.window.createTextEditorDecorationType({
    backgroundColor: bgColor,
    isWholeLine: true,
    overviewRulerColor: bgColor,
    overviewRulerLane: vscode.OverviewRulerLane.Full,
  });
}

export function createFirstLineHighlight(
  color: string,
  opacity: number
): vscode.TextEditorDecorationType {
  const bgColor = `rgba(${color}, ${opacity})`;
  return vscode.window.createTextEditorDecorationType({
    backgroundColor: bgColor,
    isWholeLine: true,
    overviewRulerColor: bgColor,
    overviewRulerLane: vscode.OverviewRulerLane.Full,
  });
}

export function createLastLineHighlight(
  color: string,
  opacity: number
): vscode.TextEditorDecorationType {
  const bgColor = `rgba(${color}, ${opacity})`;
  return vscode.window.createTextEditorDecorationType({
    backgroundColor: bgColor,
    isWholeLine: true,
    overviewRulerColor: bgColor,
    overviewRulerLane: vscode.OverviewRulerLane.Full,
  });
}
