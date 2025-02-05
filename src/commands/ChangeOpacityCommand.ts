import * as vscode from "vscode";
import { Command } from "./Command";
import { Highlighter } from "../decorations/Highlighter";

export class ChangeOpacityCommand extends Command {
  private readonly CONFIG_SECTION = "pyScope";

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

        const opacityOptions: OpacityOption[] = [
          {
            label: "Block Highlight Opacity",
            key: "blockHighlightOpacity",
            defaultValue: 0.08,
          },
          {
            label: "First and Last Line Opacity",
            key: "firstLastLineOpacity",
            defaultValue: 0.2,
          },
        ];

        const selectedOption = await vscode.window.showQuickPick(
          opacityOptions,
          {
            placeHolder: "Select the opacity setting to change",
          }
        );

        if (selectedOption) {
          const input = await vscode.window.showInputBox({
            prompt: `Enter a number (0 < opacity ≤ 1) for ${selectedOption.label}. Leave empty to use default (${selectedOption.defaultValue}).`,
            validateInput: (value: string) => {
              if (value.trim() === "") {
                return null;
              }
              const num = parseFloat(value);
              if (isNaN(num) || num <= 0 || num > 1) {
                return "Please enter a valid number between 0 (exclusive) and 1 (inclusive).";
              }
              return null;
            },
          });

          if (input !== undefined) {
            let numValue: number;
            if (input.trim() === "") {
              numValue = selectedOption.defaultValue;
            } else {
              numValue = parseFloat(input);
              if (isNaN(numValue) || numValue <= 0 || numValue > 1) {
                vscode.window.showErrorMessage(
                  "Invalid opacity value. Must be a number between 0 (exclusive) and 1 (inclusive)."
                );
                return;
              }
            }

            const config = vscode.workspace.getConfiguration(
              this.CONFIG_SECTION
            );
            await config.update(
              selectedOption.key,
              numValue,
              vscode.ConfigurationTarget.Global
            );
            vscode.window.showInformationMessage(
              `${selectedOption.label} updated to ${numValue}`
            );

            // Trigger an immediate decoration update.
            this.highlighter.updateDecorations();
          }
        }
      }
    );
  }
}
