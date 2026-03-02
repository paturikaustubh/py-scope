import * as vscode from "vscode";
import { Command } from "./Command";
import { Highlighter } from "../decorations/Highlighter";
import { CONFIG_SECTION, DEFAULTS } from "../constants";

export class ChangeOpacityCommand extends Command {
  constructor(private highlighter: Highlighter) {
    super();
  }

  public register(): vscode.Disposable {
    return vscode.commands.registerCommand(
      "pyScope.changeOpacity",
      async () => {
        interface OpacityOption extends vscode.QuickPickItem {
          key: string;
          defaultValue: number;
        }

        // Let the user pick which of the two opacity settings to change.
        const opacityOptions: OpacityOption[] = [
          {
            label: "Block Highlight Opacity",
            key: "blockHighlightOpacity",
            defaultValue: DEFAULTS.blockOpacity,
          },
          {
            label: "First and Last Line Opacity",
            key: "firstLastLineOpacity",
            defaultValue: DEFAULTS.firstLastOpacity,
          },
        ];

        const selected = await vscode.window.showQuickPick(opacityOptions, {
          placeHolder: "Select the opacity setting to change",
        });
        if (!selected) {
          return;
        }

        const input = await vscode.window.showInputBox({
          prompt: `Enter a number (0 < opacity ≤ 1) for "${selected.label}". Leave empty to reset to default (${selected.defaultValue}).`,
          validateInput: (value) => {
            if (value.trim() === "") {
              return null; // empty = reset to default, that's fine
            }
            const num = parseFloat(value);
            if (isNaN(num) || num <= 0 || num > 1) {
              return "Please enter a number between 0 (exclusive) and 1 (inclusive).";
            }
            return null;
          },
        });

        // `undefined` means the user dismissed the input box — do nothing.
        if (input === undefined) {
          return;
        }

        const newValue =
          input.trim() === "" ? selected.defaultValue : parseFloat(input);

        if (isNaN(newValue) || newValue <= 0 || newValue > 1) {
          vscode.window.showErrorMessage(
            "Invalid opacity value. Must be between 0 (exclusive) and 1 (inclusive).",
          );
          return;
        }

        const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
        await config.update(
          selected.key,
          newValue,
          vscode.ConfigurationTarget.Global,
        );
        vscode.window.showInformationMessage(
          `${selected.label} updated to ${newValue}`,
        );
        this.highlighter.updateDecorations(vscode.window.activeTextEditor);
      },
    );
  }
}
