import * as vscode from "vscode";
import { Command } from "./Command";
import { Highlighter } from "../decorations/Highlighter";

export class ChangeColorCommand extends Command {
  private readonly CONFIG_SECTION = "pyScope";

  constructor(
    private context: vscode.ExtensionContext,
    private highlighter: Highlighter,
  ) {
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
        if (selectedColor.value === "custom") {
          const panel = vscode.window.createWebviewPanel(
            "colorPicker",
            "Color Picker",
            vscode.ViewColumn.One,
            { enableScripts: true },
          );

          panel.webview.html = this.getWebviewContent(
            panel.webview,
            this.context.extensionUri,
          );

          panel.webview.onDidReceiveMessage(
            async (message) => {
              if (message.command === "updateColor") {
                const newColor = message.color;
                const config = vscode.workspace.getConfiguration(
                  this.CONFIG_SECTION,
                );
                await config.update(
                  "blockHighlightColor",
                  newColor,
                  vscode.ConfigurationTarget.Global,
                );

                vscode.window.showInformationMessage(
                  `PyScope highlight color updated to: ${newColor}`,
                );
                this.highlighter.updateDecorations(
                  vscode.window.activeTextEditor,
                );
              } else if (message.command === "cancel") {
                panel.dispose();
              }
            },
            undefined,
            this.context.subscriptions,
          );
        } else {
          const newColor = selectedColor.value;

          const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
          await config.update(
            "blockHighlightColor",
            newColor,
            vscode.ConfigurationTarget.Global,
          );
          vscode.window.showInformationMessage(
            `PyScope highlight color updated to: ${newColor}`,
          );

          // Trigger immediate re-highlighting after a color change.
          this.highlighter.updateDecorations(vscode.window.activeTextEditor);
        }
      }
    });
  }

  private getWebviewContent(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
  ): string {
    const colorPickerUIPath = vscode.Uri.joinPath(
      extensionUri,
      "color-picker-ui",
    );
    const stylesPath = vscode.Uri.joinPath(colorPickerUIPath, "styles.css");
    const stylesUri = webview.asWebviewUri(stylesPath);

    const htmlPath = vscode.Uri.joinPath(colorPickerUIPath, "index.html");
    const html = require("fs").readFileSync(htmlPath.fsPath, "utf8");

    const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
    const blockHighlightColor = config.get<string>(
      "blockHighlightColor",
      "27, 153, 5",
    ); // Default color

    return html
      .replace(
        '<link rel="stylesheet" href="styles.css">',
        `<link rel="stylesheet" href="${stylesUri}">`,
      )
      .replace(
        "</body>",
        `<script>window.blockHighlightColor = "${blockHighlightColor}";</script></body>`,
      );
  }
}
