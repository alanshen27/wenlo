import type { FolderItem, FolderItemRef } from "@/lib/library/folders";
import type { DragEndEvent } from "@dnd-kit/core";

export function itemDragId(item: FolderItemRef) {
  return `item:${item.kind}:${item.id}` as const;
}

export function folderDropId(folderId: string | null) {
  return folderId ? (`folder:${folderId}` as const) : ("folder:__root__" as const);
}

export function parseItemDragId(id: string | number): FolderItemRef | null {
  const value = String(id);
  const match = /^item:(page|document):(.+)$/.exec(value);
  if (!match) return null;
  return { kind: match[1] as FolderItem["kind"], id: match[2] };
}

export function parseFolderDropId(id: string | number): string | null | undefined {
  const value = String(id);
  if (value === "folder:__root__") return null;
  if (value.startsWith("folder:")) return value.slice("folder:".length);
  return undefined;
}

export function dragItemFromData(data: unknown): FolderItem | null {
  const item = data as FolderItem | undefined;
  if (!item?.title || !item.id) return null;
  if (item.kind !== "page" && item.kind !== "document") return null;
  return item;
}

export function resolveFolderDrop(
  event: DragEndEvent
): { item: FolderItem; targetFolderId: string | null } | null {
  const item = dragItemFromData(event.active.data.current);
  if (!item || !event.over) return null;
  const targetFolderId = parseFolderDropId(event.over.id);
  if (targetFolderId === undefined) return null;
  return { item, targetFolderId };
}
