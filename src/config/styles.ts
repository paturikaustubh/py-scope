import * as vscode from "vscode";

const globals = {
  generalBgOpacity: "0.08",
  firstLastBgOpacity: "0.2",
};

export function createBlockHighlight(
  color: string
): vscode.TextEditorDecorationType {
  return vscode.window.createTextEditorDecorationType({
    backgroundColor: `rgba(${color}, ${globals.generalBgOpacity})`,
    isWholeLine: true,
    overviewRulerColor: `rgb(${color})`,
    overviewRulerLane: vscode.OverviewRulerLane.Full,
  });
}

export function createFirstLineHighlight(
  color: string
): vscode.TextEditorDecorationType {
  return vscode.window.createTextEditorDecorationType({
    backgroundColor: `rgba(${color}, ${globals.firstLastBgOpacity})`,
    isWholeLine: true,
    overviewRulerColor: `rgb(${color})`,
    overviewRulerLane: vscode.OverviewRulerLane.Full,
  });
}

export function createLastLineHighlight(
  color: string
): vscode.TextEditorDecorationType {
  return vscode.window.createTextEditorDecorationType({
    backgroundColor: `rgba(${color}, ${globals.firstLastBgOpacity})`,
    isWholeLine: true,
    overviewRulerColor: `rgb(${color})`,
    overviewRulerLane: vscode.OverviewRulerLane.Full,
  });
}
