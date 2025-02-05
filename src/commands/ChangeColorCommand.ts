import * as vscode from "vscode";
import { Command } from "./Command";
import { Highlighter } from "../decorations/Highlighter";

export class ChangeColorCommand extends Command {
  private readonly CONFIG_SECTION = "pyScope";

  constructor(private highlighter: Highlighter) {
    super();
  }

  public register(): vscode.Disposable {
    return vscode.commands.registerCommand("pyScope.changeColor", async () => {
      interface ColorOption extends vscode.QuickPickItem {
        value: string;
      }

      const colorOptions: ColorOption[] = [
        { label: "Default", value: "27, 153, 5" },
        { label: "Red", value: "255, 69, 69" },
        { label: "Yellow", value: "243, 255, 69" },
        { label: "Blue", value: "69, 69, 255" },
        { label: "Custom...", value: "custom" },
      ];

      const selectedColor = await vscode.window.showQuickPick(colorOptions, {
        placeHolder: "Select a color or choose Custom...",
      });

      if (selectedColor) {
        let newColor = selectedColor.value;

        if (newColor === "custom") {
          const customColor = await vscode.window.showInputBox({
            prompt:
              "Enter RGB color (e.g., 255,0,0) or leave empty for default",
            placeHolder: "27, 153, 5",
            validateInput: (input) => {
              if (!input || input.trim() === "") {
                return null; // Allow empty input for fallback.
              }
              const parts = input.split(",");
              if (parts.length !== 3) {
                return "Invalid format. Use R,G,B (e.g., 255,0,0).";
              }
              for (const part of parts) {
                const num = parseInt(part.trim(), 10);
                if (isNaN(num) || num < 0 || num > 255) {
                  return "Each value must be between 0 and 255.";
                }
              }
              return null;
            },
          });

          if (!customColor || customColor.trim() === "") {
            newColor = "27, 153, 5";
          } else {
            newColor = customColor;
          }
        }

        const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
        await config.update(
          "blockHighlightColor",
          newColor,
          vscode.ConfigurationTarget.Global
        );
        vscode.window.showInformationMessage(
          `PyScope highlight color updated to: ${newColor}`
        );

        // Trigger immediate re-highlighting after a color change.
        this.highlighter.updateDecorations();
      }
    });
  }
}
