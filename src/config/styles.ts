import * as vscode from "vscode";

export function createBlockHighlight(
  color: string,
  opacity: number
): vscode.TextEditorDecorationType {
  return vscode.window.createTextEditorDecorationType({
    backgroundColor: `rgba(${color}, ${opacity})`,
    isWholeLine: true,
    overviewRulerColor: `rgb(${color})`,
    overviewRulerLane: vscode.OverviewRulerLane.Full,
  });
}

export function createFirstLineHighlight(
  color: string,
  opacity: number
): vscode.TextEditorDecorationType {
  return vscode.window.createTextEditorDecorationType({
    backgroundColor: `rgba(${color}, ${opacity})`,
    isWholeLine: true,
    overviewRulerColor: `rgb(${color})`,
    overviewRulerLane: vscode.OverviewRulerLane.Full,
  });
}

export function createLastLineHighlight(
  color: string,
  opacity: number
): vscode.TextEditorDecorationType {
  return vscode.window.createTextEditorDecorationType({
    backgroundColor: `rgba(${color}, ${opacity})`,
    isWholeLine: true,
    overviewRulerColor: `rgb(${color})`,
    overviewRulerLane: vscode.OverviewRulerLane.Full,
  });
}
