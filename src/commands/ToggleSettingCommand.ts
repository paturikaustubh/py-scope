import * as vscode from "vscode";
import { Command } from "./Command";
import { CONFIG_SECTION } from "../constants";

export class ToggleSettingCommand implements Command {
  constructor(
    private settingName: string,
    private commandName: string,
  ) {}

  public register(): vscode.Disposable {
    return vscode.commands.registerCommand(this.commandName, async () => {
      const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
      const currentValue = config.get<boolean>(this.settingName, true);
      await config.update(
        this.settingName,
        !currentValue,
        vscode.ConfigurationTarget.Global,
      );

      const humanName = this.settingName
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase());
      vscode.window.showInformationMessage(
        `PyScope: ${humanName} is now ${!currentValue ? "ON" : "OFF"}`,
      );
    });
  }
}
