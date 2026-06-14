import type { FolderNode } from "@/lib/folders";

export type TreeItemRef = {
  type: "page" | "document";
  id: string;
  title: string;
  docType?: string;
};

export type OptimisticDocument = {
  id: string;
  title: string;
  type: string;
  pending?: boolean;
};

function cloneTree(tree: FolderNode[]): FolderNode[] {
  return tree.map((node) => ({
    ...node,
    pages: [...node.pages],
    documents: node.documents.map((d) => ({ ...d })),
    children: cloneTree(node.children),
  }));
}

function walkNodes(tree: FolderNode[], visit: (node: FolderNode) => void) {
  for (const node of tree) {
    visit(node);
    walkNodes(node.children, visit);
  }
}

function findFolderNode(tree: FolderNode[], folderId: string): FolderNode | null {
  for (const node of tree) {
    if (node.id === folderId) return node;
    const found = findFolderNode(node.children, folderId);
    if (found) return found;
  }
  return null;
}

function ensureRootNode(tree: FolderNode[]): FolderNode[] {
  if (tree.some((n) => n.id === "__root__")) return tree;
  return [
    {
      id: "__root__",
      name: "Library",
      color: "gray",
      parentId: null,
      children: [],
      pages: [],
      documents: [],
    },
    ...tree,
  ];
}

export function findItemFolderId(
  tree: FolderNode[],
  item: Pick<TreeItemRef, "type" | "id">
): string | null | undefined {
  const found = findItemInTree(tree, item);
  return found?.folderId;
}

export function findItemInTree(
  tree: FolderNode[],
  item: Pick<TreeItemRef, "type" | "id">
): { title: string; docType?: string; folderId: string | null } | null {
  let result: { title: string; docType?: string; folderId: string | null } | null = null;
  walkNodes(tree, (node) => {
    if (result) return;
    const inFolder = node.id === "__root__" ? null : node.id;
    if (item.type === "page") {
      const page = node.pages.find((p) => p.id === item.id);
      if (page) result = { title: page.title, folderId: inFolder };
    }
    if (item.type === "document") {
      const doc = node.documents.find((d) => d.id === item.id);
      if (doc) result = { title: doc.title, docType: doc.type, folderId: inFolder };
    }
  });
  return result;
}

export function moveItemInTree(
  tree: FolderNode[],
  item: TreeItemRef,
  targetFolderId: string | null
): FolderNode[] {
  let next = cloneTree(tree);

  walkNodes(next, (node) => {
    if (item.type === "page") {
      node.pages = node.pages.filter((p) => p.id !== item.id);
    } else {
      node.documents = node.documents.filter((d) => d.id !== item.id);
    }
  });

  if (targetFolderId === null) {
    next = ensureRootNode(next);
    const root = next.find((n) => n.id === "__root__")!;
    if (item.type === "page") {
      root.pages.push({ id: item.id, title: item.title });
    } else {
      root.documents.push({
        id: item.id,
        title: item.title,
        type: item.docType ?? "OTHER",
      });
    }
    return next;
  }

  const target = findFolderNode(next, targetFolderId);
  if (!target) return tree;

  if (item.type === "page") {
    target.pages.push({ id: item.id, title: item.title });
  } else {
    target.documents.push({
      id: item.id,
      title: item.title,
      type: item.docType ?? "OTHER",
    });
  }

  return next;
}

export function addOptimisticDocuments(
  tree: FolderNode[],
  documents: OptimisticDocument[],
  folderId: string | null
): FolderNode[] {
  let next = cloneTree(tree);

  if (folderId === null) {
    next = ensureRootNode(next);
    const root = next.find((n) => n.id === "__root__")!;
    root.documents.unshift(...documents.map((d) => ({ ...d, pending: true })));
    return next;
  }

  const target = findFolderNode(next, folderId);
  if (!target) return tree;
  target.documents.unshift(...documents.map((d) => ({ ...d, pending: true })));
  return next;
}

export function replaceOptimisticDocument(
  tree: FolderNode[],
  tempId: string,
  document: { id: string; title: string; type: string; processing?: boolean }
): FolderNode[] {
  const next = cloneTree(tree);
  walkNodes(next, (node) => {
    const idx = node.documents.findIndex((d) => d.id === tempId);
    if (idx === -1) return;
    node.documents[idx] = {
      id: document.id,
      title: document.title,
      type: document.type,
      processing: document.processing,
    };
  });
  return next;
}

/** Toggles the background-indexing spinner for a real (non-pending) document. */
export function setDocumentProcessing(
  tree: FolderNode[],
  id: string,
  processing: boolean
): FolderNode[] {
  const next = cloneTree(tree);
  walkNodes(next, (node) => {
    const doc = node.documents.find((d) => d.id === id);
    if (doc) doc.processing = processing;
  });
  return next;
}

export function removeOptimisticDocument(tree: FolderNode[], tempId: string): FolderNode[] {
  const next = cloneTree(tree);
  walkNodes(next, (node) => {
    node.documents = node.documents.filter((d) => d.id !== tempId);
  });
  return next;
}

export function guessDocumentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "PDF";
  if (ext === "doc" || ext === "docx") return "DOC";
  if (ext === "ppt" || ext === "pptx") return "SLIDES";
  if (["md", "markdown", "txt"].includes(ext)) return "NOTE";
  if (["ts", "tsx", "js", "jsx", "py", "go", "rs", "java", "c", "cpp", "h"].includes(ext)) {
    return "CODE";
  }
  return "OTHER";
}

export function createPendingUploads(files: File[]): OptimisticDocument[] {
  return Array.from(files).map((file) => ({
    id: `pending:${crypto.randomUUID()}`,
    title: file.name,
    type: guessDocumentType(file.name),
    pending: true,
  }));
}
