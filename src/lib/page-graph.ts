import type { PartialBlock } from "@blocknote/core";
import type {
  RecallBlockSchema,
  RecallInlineSchema,
  RecallStyleSchema,
} from "@/lib/blocknote-schema";

type RecallPartialBlock = PartialBlock<
  RecallBlockSchema,
  RecallInlineSchema,
  RecallStyleSchema
>;
import type { FolderNode } from "@/lib/folders";
import { normalizeEditorContent } from "@/lib/editor-content";

export type GraphNodeKind = "library" | "folder" | "page";

export type GraphNode = {
  id: string;
  label: string;
  kind: GraphNodeKind;
  color?: string;
};

export type GraphEdgeKind = "contains" | "link";

export type GraphEdge = {
  source: string;
  target: string;
  kind: GraphEdgeKind;
};

export type PageGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

type PageRecord = {
  id: string;
  title: string;
  folderId: string | null;
  content: unknown;
};

const LIBRARY_NODE_ID = "__library__";

export function extractLinkedPageIds(content: unknown, libraryId: string): string[] {
  const blocks = normalizeEditorContent(content);
  const ids = new Set<string>();
  const pagePath = new RegExp(`(?:/library/${libraryId})?/pages/([a-z0-9]+)`, "gi");

  function walkInline(content: unknown) {
    if (!Array.isArray(content)) return;
    for (const item of content) {
      if (!item || typeof item !== "object") continue;
      const node = item as {
        type?: string;
        href?: string;
        props?: { pageId?: string };
        content?: unknown;
      };
      if (node.type === "pageLink" && typeof node.props?.pageId === "string") {
        ids.add(node.props.pageId);
      }
      if (node.type === "link" && typeof node.href === "string") {
        for (const match of node.href.matchAll(pagePath)) {
          if (match[1]) ids.add(match[1]);
        }
      }
      if (node.content) walkInline(node.content);
    }
  }

  function walkBlocks(blockList: RecallPartialBlock[]) {
    for (const block of blockList) {
      if (block.content) walkInline(block.content);
      if (block.children?.length) walkBlocks(block.children);
    }
  }

  walkBlocks(blocks);
  return [...ids];
}

export function buildPageGraph(
  libraryName: string,
  tree: FolderNode[],
  pages: PageRecord[],
  libraryId: string
): PageGraph {
  const nodes: GraphNode[] = [
    { id: LIBRARY_NODE_ID, label: libraryName, kind: "library" },
  ];
  const edges: GraphEdge[] = [];
  const pageIds = new Set(pages.map((p) => p.id));

  function addFolderNodes(folderNodes: FolderNode[], parentId: string) {
    for (const folder of folderNodes) {
      if (folder.id === "__root__") {
        for (const page of folder.pages) {
          nodes.push({ id: page.id, label: page.title, kind: "page" });
          edges.push({ source: parentId, target: page.id, kind: "contains" });
        }
        addFolderNodes(folder.children, parentId);
        continue;
      }

      nodes.push({
        id: folder.id,
        label: folder.name,
        kind: "folder",
        color: folder.color,
      });
      edges.push({ source: parentId, target: folder.id, kind: "contains" });

      for (const page of folder.pages) {
        nodes.push({ id: page.id, label: page.title, kind: "page" });
        edges.push({ source: folder.id, target: page.id, kind: "contains" });
      }

      addFolderNodes(folder.children, folder.id);
    }
  }

  addFolderNodes(tree, LIBRARY_NODE_ID);

  for (const page of pages) {
    if (!pageIds.has(page.id)) continue;
    for (const targetId of extractLinkedPageIds(page.content, libraryId)) {
      if (targetId === page.id || !pageIds.has(targetId)) continue;
      const exists = edges.some(
        (e) => e.kind === "link" && e.source === page.id && e.target === targetId
      );
      if (!exists) {
        edges.push({ source: page.id, target: targetId, kind: "link" });
      }
    }
  }

  return { nodes, edges };
}
