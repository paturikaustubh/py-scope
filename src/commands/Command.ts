import * as vscode from "vscode";

export abstract class Command {
  /**
   * Registers the command with VS Code.
   * Must return a Disposable to be cleaned up during deactivation.
   */
  abstract register(): vscode.Disposable;
}
