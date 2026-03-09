import * as vscode from "vscode";

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function createHighlight(
  color: string,
  opacity: number,
  borderWidth?: string,
): vscode.TextEditorDecorationType {
  const bgColor = `rgba(${color}, ${opacity})`;
  const options: vscode.DecorationRenderOptions = {
    backgroundColor: bgColor,
    isWholeLine: true,
    overviewRulerColor: bgColor,
    overviewRulerLane: vscode.OverviewRulerLane.Full,
  };

  if (borderWidth) {
    options.border = `1px solid rgb(${color})`;
    options.borderWidth = borderWidth;
  }

  return vscode.window.createTextEditorDecorationType(options);
}
