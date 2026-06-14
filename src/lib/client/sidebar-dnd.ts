export type SidebarDragItem = {
  type: "page" | "document";
  id: string;
  title?: string;
  docType?: string;
};

export function itemDragId(item: SidebarDragItem) {
  return `item:${item.type}:${item.id}` as const;
}

export function folderDropId(folderId: string | null) {
  return folderId ? (`folder:${folderId}` as const) : ("folder:__root__" as const);
}

export function parseItemDragId(id: string | number): SidebarDragItem | null {
  const value = String(id);
  const match = /^item:(page|document):(.+)$/.exec(value);
  if (!match) return null;
  return { type: match[1] as SidebarDragItem["type"], id: match[2] };
}

export function parseFolderDropId(id: string | number): string | null | undefined {
  const value = String(id);
  if (value === "folder:__root__") return null;
  if (value.startsWith("folder:")) return value.slice("folder:".length);
  return undefined;
}
