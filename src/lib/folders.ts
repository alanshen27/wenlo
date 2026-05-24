export type FolderNode = {
  id: string;
  name: string;
  color: string;
  parentId: string | null;
  children: FolderNode[];
  pages: { id: string; title: string }[];
  documents: { id: string; title: string; type: string; pending?: boolean }[];
};

type FlatFolder = {
  id: string;
  name: string;
  color: string;
  parentId: string | null;
};

type FlatPage = { id: string; title: string; folderId: string | null };
type FlatDoc = { id: string; title: string; type: string; folderId: string | null };

export function buildFolderTree(
  folders: FlatFolder[],
  pages: FlatPage[],
  documents: FlatDoc[]
): FolderNode[] {
  const map = new Map<string, FolderNode>();

  for (const f of folders) {
    map.set(f.id, {
      id: f.id,
      name: f.name,
      color: f.color,
      parentId: f.parentId,
      children: [],
      pages: pages.filter((p) => p.folderId === f.id).map(({ id, title }) => ({ id, title })),
      documents: documents
        .filter((d) => d.folderId === f.id)
        .map(({ id, title, type }) => ({ id, title, type })),
    });
  }

  const roots: FolderNode[] = [];
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Root-level items (no folder)
  const rootVirtual: FolderNode = {
    id: "__root__",
    name: "Library",
    color: "gray",
    parentId: null,
    children: [],
    pages: pages.filter((p) => !p.folderId).map(({ id, title }) => ({ id, title })),
    documents: documents
      .filter((d) => !d.folderId)
      .map(({ id, title, type }) => ({ id, title, type })),
  };

  if (rootVirtual.pages.length > 0 || rootVirtual.documents.length > 0) {
    roots.unshift(rootVirtual);
  }

  return roots;
}

export function flattenPagesFromTree(tree: FolderNode[]): { id: string; title: string }[] {
  const pages: { id: string; title: string }[] = [];
  function walk(nodes: FolderNode[]) {
    for (const node of nodes) {
      pages.push(...node.pages);
      walk(node.children);
    }
  }
  walk(tree);
  return pages;
}

export function collectFolderIds(folderId: string, folders: FlatFolder[]): string[] {
  const ids = [folderId];
  const children = folders.filter((f) => f.parentId === folderId);
  for (const child of children) {
    ids.push(...collectFolderIds(child.id, folders));
  }
  return ids;
}

export type BreadcrumbItem = {
  id: string;
  name: string;
  type: "library" | "folder" | "page" | "document" | "search" | "recall" | "map";
  color?: string;
};

export function buildBreadcrumbs(opts: {
  libraryName: string;
  folders: FlatFolder[];
  folderId: string | null;
  currentItem?: { id: string; name: string; type: "page" | "document" };
}): BreadcrumbItem[] {
  const { libraryName, folders, folderId, currentItem } = opts;
  const crumbs: BreadcrumbItem[] = [{ id: "__library__", name: libraryName, type: "library" }];

  if (folderId) {
    const chain: FlatFolder[] = [];
    let current = folders.find((f) => f.id === folderId);
    while (current) {
      chain.unshift(current);
      current = current.parentId
        ? folders.find((f) => f.id === current!.parentId)
        : undefined;
    }
    for (const folder of chain) {
      crumbs.push({ id: folder.id, name: folder.name, type: "folder", color: folder.color });
    }
  }

  if (currentItem) {
    const parentColor = folderId ? folders.find((f) => f.id === folderId)?.color : undefined;
    crumbs.push({
      id: currentItem.id,
      name: currentItem.name,
      type: currentItem.type,
      ...(parentColor ? { color: parentColor } : {}),
    });
  }

  return crumbs;
}

export function findFolderNode(tree: FolderNode[], folderId: string): FolderNode | null {
  for (const node of tree) {
    if (node.id === folderId) return node;
    const found = findFolderNode(node.children, folderId);
    if (found) return found;
  }
  return null;
}

export type FolderContents = {
  folders: FolderNode[];
  pages: FolderNode["pages"];
  documents: FolderNode["documents"];
};

export function getFolderContents(tree: FolderNode[], folderId: string | null): FolderContents {
  if (!folderId) {
    const rootVirtual = tree.find((n) => n.id === "__root__");
    return {
      folders: tree.filter((n) => n.id !== "__root__"),
      pages: rootVirtual?.pages ?? [],
      documents: rootVirtual?.documents ?? [],
    };
  }

  const node = findFolderNode(tree, folderId);
  if (!node) {
    return { folders: [], pages: [], documents: [] };
  }

  return {
    folders: node.children,
    pages: node.pages,
    documents: node.documents,
  };
}
