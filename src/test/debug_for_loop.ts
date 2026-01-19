import * as fs from "fs";
import * as path from "path";

// ==========================================
// PASTE OF PARSER LOGIC WITH VSCODE MOCKS
// ==========================================

const vscodeMock = {
  Range: class {
    constructor(
      public startLine: number,
      public startChar: number,
      public endLine: number,
      public endChar: number,
    ) {}
  },
  Position: class {
    constructor(
      public line: number,
      public char: number,
    ) {}
  },
};

interface CodeBlock {
  openRange: any;
  closeRange: any;
  headerEndLine: number;
  childBlocks?: { firstLine: number; lastLine: number }[];
}

interface BlockStackItem {
  indent: number;
  startLine: number;
  colonPosition: number;
  headerEndLine: number;
}

const BLOCK_KEYWORDS = [
  "def",
  "class",
  "if",
  "elif",
  "else",
  "for",
  "while",
  "try",
  "except",
  "finally",
  "with",
  "match",
  "case",
  "async",
];

function tryGetBlockHeader(
  document: any,
  startLine: number,
): { startLine: number; colonLine: number; colonPosition: number } | undefined {
  const firstLineText = document.lineAt(startLine).text;
  const firstLineCodePart = firstLineText.split(/#.*/)[0].trim();

  const isKeyword = BLOCK_KEYWORDS.some((keyword) =>
    new RegExp(`^${keyword}\\b`).test(firstLineCodePart),
  );
  if (!isKeyword) {
    return undefined;
  }

  let parenLevel = 0;
  let lineNum = startLine;

  while (lineNum < document.lineCount) {
    const line = document.lineAt(lineNum);
    const codePart = line.text.split(/#.*/)[0];
    const trimmed = codePart.trim();

    for (const ch of codePart) {
      if ("([{".includes(ch)) {
        parenLevel++;
      } else if (")]}".includes(ch)) {
        parenLevel--;
      }
    }

    if (trimmed.endsWith(":") && parenLevel === 0) {
      const colonPos = line.text.lastIndexOf(":") + 1;
      const nextLine =
        lineNum + 1 < document.lineCount ? document.lineAt(lineNum + 1) : null;
      if (
        !nextLine ||
        nextLine.isEmptyOrWhitespace ||
        nextLine.firstNonWhitespaceCharacterIndex <=
          line.firstNonWhitespaceCharacterIndex
      ) {
        // Check if it is a single line block ? No, this logic says "if no indent after colon, ignore".
        // But what if the body is ON the same line? e.g. "if x: return"
        // The current parser splits line by # but fails to check content after colon on the same line.
        // Let's check for content after colon.
        const contentAfterColon = codePart
          .substring(codePart.lastIndexOf(":") + 1)
          .trim();
        if (contentAfterColon.length > 0) {
          // Example: "if x: return"
          // It is a valid block but endLine is likely same or next?
          // Current logic returns undefined which might be why single-line blocks are weird?
          // But let's stick to the current logic unless this is the bug.
          // The user bug is about a FOR loop which definitely has body below.
        } else {
          return undefined;
        }
      }

      return { startLine, colonLine: lineNum, colonPosition: colonPos };
    }

    if (lineNum > startLine + 20) {
      return undefined;
    }
    lineNum++;
  }

  return undefined;
}

function findBlockEnd(
  document: any,
  startLine: number, // expecting headerEndLine here based on my fix
  baseIndent: number,
): number {
  const lineCount = document.lineCount;

  for (let i = startLine + 1; i < lineCount; i++) {
    const line = document.lineAt(i);
    const trimmed = line.text.trim();

    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }

    const indent = line.firstNonWhitespaceCharacterIndex;
    if (indent <= baseIndent) {
      return i - 1;
    }
  }

  return lineCount - 1;
}

function countTripleQuotes(text: string): number {
  let count = 0;
  const tripleDouble = text.match(/"""/g);
  if (tripleDouble) {
    count += tripleDouble.length;
  }
  const tripleSingle = text.match(/'''/g);
  if (tripleSingle) {
    count += tripleSingle.length;
  }
  return count;
}

function computeInStringArray(document: any): boolean[] {
  const inStringArr: boolean[] = [];
  let inString = false;
  for (let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i).text;
    inStringArr.push(inString);
    const count = countTripleQuotes(line);
    if (count % 2 === 1) {
      inString = !inString;
    }
  }
  return inStringArr;
}

function createBlock(
  document: any,
  block: BlockStackItem,
  endLine: number,
): CodeBlock {
  let lastContentLine = endLine;
  while (lastContentLine > block.startLine) {
    const line = document.lineAt(lastContentLine);
    if (!line.isEmptyOrWhitespace) {
      break;
    }
    lastContentLine--;
  }
  const line = document.lineAt(lastContentLine);
  return {
    openRange: new vscodeMock.Range(
      block.startLine,
      block.colonPosition,
      block.startLine,
      block.colonPosition,
    ),
    closeRange: new vscodeMock.Range(
      lastContentLine,
      line.text.length,
      lastContentLine,
      line.text.length,
    ),
    headerEndLine: block.headerEndLine,
  };
}

function parsePythonBlocks(document: any): CodeBlock[] {
  const inStringArr = computeInStringArray(document);
  const blocks: CodeBlock[] = [];
  const stack: BlockStackItem[] = [];
  let lineNum = 0;

  // Debug: Print inStringArr for relevant lines
  // repro_case.py get_metadata_output starts around 682
  // Let's print string status for lines 682 to 730

  while (lineNum < document.lineCount) {
    const line = document.lineAt(lineNum);
    if (line.isEmptyOrWhitespace) {
      lineNum++;
      continue;
    }

    if (stack.length > 0 && !inStringArr[lineNum]) {
      const currentIndent = line.firstNonWhitespaceCharacterIndex;
      while (
        stack.length > 0 &&
        currentIndent <= stack[stack.length - 1].indent
      ) {
        const closedBlock = stack.pop()!;
        // With FIX: use closedBlock.headerEndLine
        const endLine = findBlockEnd(
          document,
          closedBlock.headerEndLine,
          closedBlock.indent,
        );
        const newBlock = createBlock(document, closedBlock, endLine);
        blocks.push(newBlock);
      }
    }

    // Check if the current line (or a multi-line header) starts a new block.
    // FIX: Do not parse headers if we are inside a string.
    if (!inStringArr[lineNum]) {
      const headerInfo = tryGetBlockHeader(document, lineNum);
      if (headerInfo) {
        const baseIndent = document.lineAt(
          headerInfo.startLine,
        ).firstNonWhitespaceCharacterIndex;
        stack.push({
          indent: baseIndent,
          startLine: headerInfo.startLine,
          colonPosition: headerInfo.colonPosition,
          headerEndLine: headerInfo.colonLine,
        });
        lineNum = headerInfo.colonLine + 1;
        continue;
      }
    }
    lineNum++;
  }
  while (stack.length > 0) {
    const closedBlock = stack.pop()!;
    const endLine = document.lineCount - 1;
    const newBlock = createBlock(document, closedBlock, endLine);
    blocks.push(newBlock);
  }
  return blocks;
}

// Mock Classes
class MockTextLine {
  constructor(
    public text: string,
    public lineNumber: number,
  ) {}

  get isEmptyOrWhitespace(): boolean {
    return this.text.trim().length === 0;
  }

  get firstNonWhitespaceCharacterIndex(): number {
    if (this.isEmptyOrWhitespace) return 0;
    return this.text.search(/\S/);
  }
}

class MockTextDocument {
  public lines: string[];

  constructor(content: string) {
    this.lines = content.split(/\r?\n/);
  }

  get lineCount(): number {
    return this.lines.length;
  }

  lineAt(index: number): MockTextLine {
    if (index < 0 || index >= this.lines.length) {
      throw new Error(`Invalid line index: ${index}`);
    }
    return new MockTextLine(this.lines[index], index);
  }
}

const reproFile = path.resolve(__dirname, "repro_case.py");
const content = fs.readFileSync(reproFile, "utf8");
const document = new MockTextDocument(content);

const outputFile = path.resolve(__dirname, "debug_output.txt");
let logContent = "Parsing blocks in repro_case.py...\n";

const blocks = parsePythonBlocks(document);
const relevantBlocks = blocks.filter(
  (b) => b.openRange.startLine >= 680 && b.openRange.startLine <= 740,
);

logContent += `Found ${relevantBlocks.length} blocks in range 680-740:\n`;
relevantBlocks.forEach((b) => {
  const line = document.lineAt(b.openRange.startLine).text.trim();
  logContent += `- Line ${b.openRange.startLine}: ${line.substring(0, 50)}\n`;
  logContent += `  HeaderEnd: ${b.headerEndLine}, Close: ${b.closeRange.endLine}\n`;
});

const inStringArr = computeInStringArray(document);
logContent += "\nString detection check:\n";
for (let i = 680; i <= 710; i++) {
  const line = document.lineAt(i).text;
  logContent += `Line ${i} [InString: ${inStringArr[i]}]: ${line.trim().substring(0, 40)}\n`;
}

fs.writeFileSync(outputFile, logContent);
console.log("Written output to debug_output.txt");
