import * as fs from "fs";
import * as vscode from "vscode";
import { Command } from "./Command";
import { Highlighter } from "../decorations/Highlighter";
import { CONFIG_SECTION, DEFAULTS } from "../constants";

export class ChangeColorCommand extends Command {
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
        { label: "Default", value: DEFAULTS.color },
        { label: "Red", value: "255, 69, 69" },
        { label: "Yellow", value: "243, 255, 69" },
        { label: "Blue", value: "69, 69, 255" },
        { label: "Custom...", value: "custom" },
      ];

      const selected = await vscode.window.showQuickPick(colorOptions, {
        placeHolder: "Select a color or choose Custom...",
      });
      if (!selected) {
        return;
      }

      if (selected.value === "custom") {
        // Open the webview color picker panel.
        this.openColorPickerPanel();
      } else {
        await this.applyColor(selected.value);
      }
    });
  }

  /** Saves `colorValue` to settings and triggers an immediate repaint. */
  private async applyColor(colorValue: string) {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    await config.update(
      "blockHighlightColor",
      colorValue,
      vscode.ConfigurationTarget.Global,
    );
    vscode.window.showInformationMessage(
      `PyScope highlight color updated to: ${colorValue}`,
    );
    this.highlighter.updateDecorations(vscode.window.activeTextEditor);
  }

  /** Creates and shows the custom webview color picker. */
  private openColorPickerPanel() {
    const panel = vscode.window.createWebviewPanel(
      "colorPicker",
      "PyScope Color Picker",
      vscode.ViewColumn.One,
      { enableScripts: true },
    );

    panel.webview.html = this.buildWebviewHtml(
      panel.webview,
      this.context.extensionUri,
    );

    // Listen for messages posted by the webview's JS.
    panel.webview.onDidReceiveMessage(
      async (message) => {
        if (message.command === "updateColor") {
          await this.applyColor(message.color);
        } else if (message.command === "cancel") {
          panel.dispose();
        }
      },
      undefined,
      this.context.subscriptions,
    );
  }

  /**
   * Reads the HTML template from `media/color-picker/index.html`, injects the
   * correct stylesheet URI (VS Code requires webview-specific URIs), and
   * injects the current color so the picker opens pre-loaded.
   */
  private buildWebviewHtml(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
  ): string {
    const colorPickerDir = vscode.Uri.joinPath(extensionUri, "media", "color-picker");
    const stylesUri = webview.asWebviewUri(
      vscode.Uri.joinPath(colorPickerDir, "styles.css"),
    );

    const htmlPath = vscode.Uri.joinPath(colorPickerDir, "index.html");
    const html = fs.readFileSync(htmlPath.fsPath, "utf8");

    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const currentColor = config.get<string>("blockHighlightColor", DEFAULTS.color);

    // Replace the relative stylesheet href with a webview-safe URI, then
    // inject the current color as a global JS variable before </body>.
    return html
      .replace(
        '<link rel="stylesheet" href="styles.css">',
        `<link rel="stylesheet" href="${stylesUri}">`,
      )
      .replace(
        "</body>",
        `<script>window.blockHighlightColor = "${currentColor}";</script></body>`,
      );
  }
}
