import * as vscode from "vscode";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Shared options for every decoration type that highlights a whole line. */
function wholeLine(
  bgColor: string,
  extra: Partial<vscode.DecorationRenderOptions> = {},
): vscode.TextEditorDecorationType {
  return vscode.window.createTextEditorDecorationType({
    backgroundColor: bgColor,
    isWholeLine: true,
    // Mirror the background in the scrollbar overview ruler so the user can
    // see highlighted blocks even when they're scrolled out of view.
    overviewRulerColor: bgColor,
    overviewRulerLane: vscode.OverviewRulerLane.Full,
    ...extra,
  });
}

// ─── Decoration factories ─────────────────────────────────────────────────────

/**
 * Body lines between the header and the last line.
 * Lower opacity — the intent is a subtle background tint, not a distraction.
 */
export function createBlockHighlight(
  color: string,
  opacity: number,
): vscode.TextEditorDecorationType {
  return wholeLine(`rgba(${color}, ${opacity})`);
}

/**
 * Header lines that are NOT the last header line (only appears for multi-line
 * function signatures where the `def` and the `)` are on different lines).
 */
export function createFirstLineHighlight(
  color: string,
  opacity: number,
): vscode.TextEditorDecorationType {
  return wholeLine(`rgba(${color}, ${opacity})`);
}

/**
 * The last line of the header — the one with the closing `:`.
 * Higher opacity than the body, plus a bottom border that visually separates
 * the header from the body below.
 */
export function createFirstLastLineHighlight(
  color: string,
  opacity: number,
): vscode.TextEditorDecorationType {
  const borderColor = `rgb(${color})`;
  return wholeLine(`rgba(${color}, ${opacity})`, {
    border: `1px solid ${borderColor}`,
    borderWidth: "0 0 1px 0",
  });
}

/**
 * The last content line of the block.
 * Higher opacity + a top border that mirrors the header's bottom border,
 * giving the block a visual "bracket" around it.
 */
export function createLastLineHighlight(
  color: string,
  opacity: number,
): vscode.TextEditorDecorationType {
  const borderColor = `rgb(${color})`;
  return wholeLine(`rgba(${color}, ${opacity})`, {
    border: `1px solid ${borderColor}`,
    borderWidth: "1px 0 0 0",
  });
}

/**
 * Used when the entire block fits on a single line (e.g. `def f(): pass`).
 * Top + bottom border so it still looks "framed" even without a separate last line.
 */
export function createSingleLineBlockHighlight(
  color: string,
  opacity: number,
): vscode.TextEditorDecorationType {
  const borderColor = `rgb(${color})`;
  return wholeLine(`rgba(${color}, ${opacity})`, {
    border: `1px solid ${borderColor}`,
    borderWidth: "1px 0 1px 0",
  });
}
