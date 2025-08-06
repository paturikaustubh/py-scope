import { CodeBlock } from "../parsers/pythonParser";
import { Position, Range } from "vscode";

export class CodeBlockNode {
  public id: string;
  public parent: CodeBlockNode | null = null;
  public children: CodeBlockNode[] = [];

  constructor(public block: CodeBlock) {
    this.id = `${block.openRange.start.line}-${block.closeRange.end.line}`;
  }
}

export class BlockTree {
  public root: CodeBlockNode;

  constructor(blocks: CodeBlock[]) {
    this.root = this.buildTree(blocks);
  }

  private buildTree(blocks: CodeBlock[]): CodeBlockNode {
    const rootBlock: CodeBlock = {
      openRange: new Range(new Position(0, 0), new Position(0, 0)),
      closeRange: new Range(
        new Position(Infinity, 0),
        new Position(Infinity, 0),
      ),
      headerEndLine: -1,
    };
    const rootNode = new CodeBlockNode(rootBlock);

    if (blocks.length === 0) {
      return rootNode;
    }

    const nodes = blocks.map((block) => new CodeBlockNode(block));
    nodes.sort((a, b) => {
      const aSize = a.block.closeRange.end.line - a.block.openRange.start.line;
      const bSize = b.block.closeRange.end.line - b.block.openRange.start.line;
      return aSize - bSize;
    });

    nodes.forEach((node) => {
      let parentNode: CodeBlockNode | undefined;
      for (const potentialParent of nodes) {
        if (
          potentialParent.block.openRange.start.line <
            node.block.openRange.start.line &&
          potentialParent.block.closeRange.end.line >=
            node.block.closeRange.end.line
        ) {
          if (
            !parentNode ||
            potentialParent.block.closeRange.end.line -
              potentialParent.block.openRange.start.line <
              parentNode.block.closeRange.end.line -
                parentNode.block.openRange.start.line
          ) {
            parentNode = potentialParent;
          }
        }
      }
      if (parentNode) {
        parentNode.children.push(node);
        node.parent = parentNode;
      } else {
        rootNode.children.push(node);
        node.parent = rootNode;
      }
    });

    return rootNode;
  }

  public findNodeAtLine(lineNumber: number): CodeBlockNode | undefined {
    let bestMatch: CodeBlockNode | undefined = this.root;

    const search = (node: CodeBlockNode) => {
      // Check if the current node contains the line number
      if (
        lineNumber >= node.block.openRange.start.line &&
        lineNumber <= node.block.closeRange.end.line
      ) {
        // If this node is a better (more specific) match, update bestMatch
        if (
          !bestMatch ||
          bestMatch.block.closeRange.end.line -
            bestMatch.block.openRange.start.line >
            node.block.closeRange.end.line - node.block.openRange.start.line
        ) {
          bestMatch = node;
        }
      }

      // Continue searching in children
      for (const child of node.children) {
        search(child);
      }
    };

    search(this.root);

    return bestMatch === this.root ? undefined : bestMatch;
  }

  public findNodeById(id: string): CodeBlockNode | undefined {
    const queue = [this.root];
    while (queue.length > 0) {
      const node = queue.shift()!;
      if (node.id === id) {
        return node;
      }
      queue.push(...node.children);
    }
    return undefined;
  }
}
