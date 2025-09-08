import * as vscode from "vscode";

export function createBlockHighlight(
  color: string,
  opacity: number,
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
  opacity: number,
): vscode.TextEditorDecorationType {
  const bgColor = `rgba(${color}, ${opacity})`;
  return vscode.window.createTextEditorDecorationType({
    backgroundColor: bgColor,
    isWholeLine: true,
    overviewRulerColor: bgColor,
    overviewRulerLane: vscode.OverviewRulerLane.Full,
  });
}

export function createFirstLastLineHighlight(
  color: string,
  opacity: number,
): vscode.TextEditorDecorationType {
  const bgColor = `rgba(${color}, ${opacity})`;
  const borderColor = `rgb(${color})`;
  return vscode.window.createTextEditorDecorationType({
    backgroundColor: bgColor,
    isWholeLine: true,
    overviewRulerColor: bgColor,
    overviewRulerLane: vscode.OverviewRulerLane.Full,
    border: `1px solid ${borderColor}`,
    borderWidth: "0 0 1px 0", // Bottom border
  });
}

export function createLastLineHighlight(
  color: string,
  opacity: number,
): vscode.TextEditorDecorationType {
  const bgColor = `rgba(${color}, ${opacity})`;
  const borderColor = `rgb(${color})`;

  return vscode.window.createTextEditorDecorationType({
    backgroundColor: bgColor,
    isWholeLine: true,
    overviewRulerColor: bgColor,
    overviewRulerLane: vscode.OverviewRulerLane.Full,
    border: `1px solid ${borderColor}`,
    borderWidth: "1px 0 0 0",
  });
}

export function createSingleLineBlockHighlight(
  color: string,
  opacity: number,
): vscode.TextEditorDecorationType {
  const bgColor = `rgba(${color}, ${opacity})`;
  const borderColor = `rgb(${color})`;
  return vscode.window.createTextEditorDecorationType({
    backgroundColor: bgColor,
    isWholeLine: true,
    overviewRulerColor: bgColor,
    overviewRulerLane: vscode.OverviewRulerLane.Full,
    border: `1px solid ${borderColor}`,
    borderWidth: "1px 0 1px 0", // Top and bottom border
  });
}
