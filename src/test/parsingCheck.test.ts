import * as assert from "assert";
import * as vscode from "vscode";
import * as path from "path";
import { parsePythonBlocks } from "../parsers/pythonParser";

suite("Parsing Debug Test Suite", () => {
  test("DEBUG: Parse repro_case.py and check _handle_storage_if_any", async () => {
    // 1. Open the reproduction file
    const reproFilePath = path.resolve(
      __dirname,
      "../../src/test/repro_case.py",
    );
    const document = await vscode.workspace.openTextDocument(reproFilePath);

    // 2. Parse the blocks
    console.log(`Parsing file: ${reproFilePath}`);
    const blocks = parsePythonBlocks(document);

    // 3. Find the block corresponding to _handle_storage_if_any (line 444)
    // The previous analysis showed the function starts on line 444 (1-indexed in UI, 0-indexed in API? Let's check).
    // In VS Code API, lines are 0-indexed.
    // The user saw it at line 444. Let's assume 0-indexed 444 or close to it.
    // Actually, let's search for the block that starts with "def _handle_storage_if_any"

    const targetBlockIndex = blocks.findIndex((b) => {
      const line = document.lineAt(b.openRange.start.line).text;
      return line.includes("def _handle_storage_if_any");
    });

    if (targetBlockIndex === -1) {
      console.error("❌ Could not find block for _handle_storage_if_any");
      // Print all blocks to help debugging
      console.log(
        "Found blocks:",
        blocks.map(
          (b) =>
            `Start: ${b.openRange.start.line}, HeaderEnd: ${b.headerEndLine}, Close: ${b.closeRange.end.line}`,
        ),
      );
      assert.fail("Could not find target block");
    }

    const targetBlock = blocks[targetBlockIndex];
    console.log("✅ Found target block:", targetBlock);
    console.log(`   Start Line: ${targetBlock.openRange.start.line}`);
    console.log(`   Header End Line: ${targetBlock.headerEndLine}`);
    console.log(`   Block End Line: ${targetBlock.closeRange.end.line}`);

    // Adjust these expectations based on manual analysis of repro_case.py
    // Start should be 444
    // Header closes at line 449: ) -> int:
    // Body seems to end at line 463: return count

    assert.strictEqual(
      targetBlock.openRange.start.line,
      443,
      "Start line should be 443 (0-indexed)",
    );
    assert.strictEqual(
      targetBlock.headerEndLine,
      448,
      "Header end line (colon line) should be 448 (0-indexed)",
    );
    assert.strictEqual(
      targetBlock.closeRange.end.line,
      462,
      "Block end line should be 462 (0-indexed)",
    );
  });
});
