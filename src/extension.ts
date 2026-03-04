import * as vscode from "vscode";
import { debounce } from "./utils/debounce";
import { Highlighter } from "./decorations/Highlighter";
import { ChangeColorCommand } from "./commands/ChangeColorCommand";
import { ChangeOpacityCommand } from "./commands/ChangeOpacityCommand";
import { SelectBlockCommand } from "./commands/SelectBlockCommand";
import { UndoBlockSelectionCommand } from "./commands/UndoBlockSelectionCommand";
import { ToggleSettingCommand } from "./commands/ToggleSettingCommand";

// Module-level so `deactivate()` can reach it without closing over a stale ref.
let highlighter: Highlighter;

export function activate(context: vscode.ExtensionContext) {
  console.log("PyScope activated");

  highlighter = new Highlighter();

  // ── Commands ────────────────────────────────────────────────────────────────
  const commands = [
    new ChangeColorCommand(context, highlighter),
    new ChangeOpacityCommand(highlighter),
    new SelectBlockCommand(highlighter),
    new UndoBlockSelectionCommand(highlighter),
    new ToggleSettingCommand(
      "showFirstLineHighlight",
      "pyScope.toggleFirstLineHighlight",
    ),
    new ToggleSettingCommand(
      "showFirstLineBorder",
      "pyScope.toggleFirstLineBorder",
    ),
    new ToggleSettingCommand(
      "showLastLineHighlight",
      "pyScope.toggleLastLineHighlight",
    ),
    new ToggleSettingCommand(
      "showLastLineBorder",
      "pyScope.toggleLastLineBorder",
    ),
  ];
  commands.forEach((cmd) => context.subscriptions.push(cmd.register()));

  // ── Event handlers ──────────────────────────────────────────────────────────

  // Called when the document text actually changes — we need to discard the
  // cached block tree because the line structure may have shifted.
  const onDocumentChange = (editor: vscode.TextEditor) => {
    highlighter.updateDecorations(editor);
  };

  // Called when only the cursor/selection changes — the document is untouched,
  // so the cached block tree is still valid and we skip invalidation.
  const onCursorChange = (editor: vscode.TextEditor) => {
    highlighter.updateDecorations(editor);
  };

  const debouncedDocChange = debounce(onDocumentChange, 100);
  const debouncedCursorChange = debounce(onCursorChange, 100);

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      highlighter.invalidateBlockTree(e.document.uri.toString());
      const editor = vscode.window.activeTextEditor;
      if (!editor || e.document !== editor.document) {
        return;
      }

      // Alt+Up / Alt+Down (move line) produces multiple content changes at once.
      // Running synchronously here prevents the highlight from "smearing" across
      // the old position for a frame before the debounce fires.
      if (e.contentChanges.length > 1) {
        highlighter.clearAllDecorations(editor);
        onDocumentChange(editor);
      } else {
        debouncedDocChange(editor);
      }
    }),

    vscode.window.onDidChangeTextEditorSelection((e) => {
      if (!e.textEditor) {
        return;
      }
      // If the cursor moved far enough in time from the last Ctrl+Alt+A, treat
      // it as the user breaking out of the block-selection chain.
      if (Date.now() - highlighter.lastSelectionTimestamp > 100) {
        highlighter.resetSelectionState(e.textEditor);
      }
      debouncedCursorChange(e.textEditor);
    }),

    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        // Tab switch — cursor position hasn't changed so tree is still valid.
        debouncedCursorChange(editor);
      }
    }),

    vscode.workspace.onDidCloseTextDocument((document) => {
      highlighter.invalidateBlockTree(document.uri.toString());
    }),
  );
}

export function deactivate() {
  console.log("PyScope deactivated");
  highlighter.dispose();
}
