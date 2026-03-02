import { CodeBlock } from "../parsers/pythonParser";
import { Position, Range } from "vscode";

// ─── Node ─────────────────────────────────────────────────────────────────────

export class CodeBlockNode {
  /** Unique ID derived from line numbers — used by `findNodeById` for undo. */
  public id: string;
  public parent: CodeBlockNode | null = null;
  public children: CodeBlockNode[] = [];

  constructor(public block: CodeBlock) {
    this.id = `${block.openRange.start.line}-${block.closeRange.end.line}`;
  }
}

// ─── Tree ─────────────────────────────────────────────────────────────────────

export class BlockTree {
  /** Synthetic sentinel root that contains every real block. Never highlighted. */
  public root: CodeBlockNode;

  constructor(blocks: CodeBlock[]) {
    this.root = this.buildTree(blocks);
  }

  /**
   * Turns a flat array of parsed blocks into a proper parent-child hierarchy.
   *
   * Strategy: sort nodes from smallest to largest, then for each node find its
   * "tightest enclosing ancestor" — the containing node with the smallest span.
   * Sorting small-first ensures a child is never processed before its parent,
   * which lets us do the O(n²) containment scan without needing multiple passes.
   */
  private buildTree(blocks: CodeBlock[]): CodeBlockNode {
    // The root is a virtual block spanning the entire file (0 → ∞).
    // We use Infinity here because we don't have the document length at this
    // point — the root is never matched by findNodeAtLine anyway.
    const rootBlock: CodeBlock = {
      openRange: new Range(new Position(0, 0), new Position(0, 0)),
      closeRange: new Range(new Position(Infinity, 0), new Position(Infinity, 0)),
      headerEndLine: -1,
    };
    const rootNode = new CodeBlockNode(rootBlock);

    if (blocks.length === 0) {
      return rootNode;
    }

    const nodes = blocks.map((b) => new CodeBlockNode(b));

    // Sort smallest-span first so inner blocks are processed before outer ones.
    nodes.sort((a, b) => {
      const aSpan = a.block.closeRange.end.line - a.block.openRange.start.line;
      const bSpan = b.block.closeRange.end.line - b.block.openRange.start.line;
      return aSpan - bSpan;
    });

    for (const node of nodes) {
      let tightestParent: CodeBlockNode | undefined;

      for (const candidate of nodes) {
        if (candidate === node) {
          continue;
        }
        const containsNode =
          candidate.block.openRange.start.line < node.block.openRange.start.line &&
          candidate.block.closeRange.end.line >= node.block.closeRange.end.line;

        if (!containsNode) {
          continue;
        }

        // Among all containers, prefer the one with the smallest span.
        if (!tightestParent) {
          tightestParent = candidate;
        } else {
          const candidateSpan =
            candidate.block.closeRange.end.line - candidate.block.openRange.start.line;
          const currentSpan =
            tightestParent.block.closeRange.end.line - tightestParent.block.openRange.start.line;
          if (candidateSpan < currentSpan) {
            tightestParent = candidate;
          }
        }
      }

      if (tightestParent) {
        tightestParent.children.push(node);
        node.parent = tightestParent;
      } else {
        // No containing block found — attach directly to the root.
        rootNode.children.push(node);
        node.parent = rootNode;
      }
    }

    return rootNode;
  }

  /**
   * DFS through the tree to find the most specific (smallest-span) block that
   * contains `lineNumber`.  Returns `undefined` when the cursor is outside all
   * known blocks (e.g. at module level).
   */
  public findNodeAtLine(lineNumber: number): CodeBlockNode | undefined {
    let bestMatch: CodeBlockNode | undefined = this.root;

    const search = (node: CodeBlockNode) => {
      if (
        lineNumber >= node.block.openRange.start.line &&
        lineNumber <= node.block.closeRange.end.line
      ) {
        // Prefer the node with the smaller span — that's the most-nested block.
        if (
          !bestMatch ||
          node.block.closeRange.end.line - node.block.openRange.start.line <
            bestMatch.block.closeRange.end.line - bestMatch.block.openRange.start.line
        ) {
          bestMatch = node;
        }
      }

      for (const child of node.children) {
        search(child);
      }
    };

    search(this.root);

    // The root is a sentinel — if it's the "best match" it just means no real
    // block was found at this line.
    return bestMatch === this.root ? undefined : bestMatch;
  }

  /**
   * BFS lookup by node ID (format: `"startLine-endLine"`).
   * Used by `UndoBlockSelectionCommand` to re-anchor the selection chain after
   * popping from the undo stack.
   */
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
