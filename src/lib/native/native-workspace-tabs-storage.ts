import { STORAGE_KEYS } from "@/lib/client/storage-keys";
import type { NativeKind } from "@/lib/native/native-types";

export type NativeWorkspaceTabsState = {
  ids: string[];
  titles: Record<string, string>;
};

export const EMPTY_NATIVE_WORKSPACE_TABS: NativeWorkspaceTabsState = {
  ids: [],
  titles: {},
};

const MAX_TABS = 24;

export function nativeWorkspaceTabsStorageKey(kind: NativeKind) {
  return STORAGE_KEYS.nativeWorkspaceTabs(kind);
}

export function normalizeNativeWorkspaceTabs(raw: unknown): NativeWorkspaceTabsState {
  if (!raw || typeof raw !== "object") return { ...EMPTY_NATIVE_WORKSPACE_TABS };
  const { ids, titles } = raw as { ids?: unknown; titles?: unknown };
  const safeIds = Array.isArray(ids)
    ? ids.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];
  const safeTitles: Record<string, string> = {};
  if (titles && typeof titles === "object") {
    for (const [id, title] of Object.entries(titles as Record<string, unknown>)) {
      if (safeIds.includes(id) && typeof title === "string") safeTitles[id] = title;
    }
  }
  return { ids: safeIds.slice(0, MAX_TABS), titles: safeTitles };
}

/** Append an id if missing; refresh title; enforce max tab count. */
export function upsertNativeWorkspaceTab(
  state: NativeWorkspaceTabsState,
  id: string,
  title: string
): NativeWorkspaceTabsState {
  const label = title.trim() || "Untitled";
  if (state.ids.includes(id) && state.titles[id] === label) {
    return state;
  }
  let ids = state.ids.includes(id) ? state.ids : [...state.ids, id];
  if (ids.length > MAX_TABS) {
    const drop = ids.length - MAX_TABS;
    const removed = ids.slice(0, drop);
    ids = ids.slice(drop);
    const titles = { ...state.titles, [id]: label };
    for (const removedId of removed) delete titles[removedId];
    return { ids, titles };
  }
  return {
    ids,
    titles: { ...state.titles, [id]: label },
  };
}

export function removeNativeWorkspaceTab(
  state: NativeWorkspaceTabsState,
  id: string
): NativeWorkspaceTabsState {
  const ids = state.ids.filter((tabId) => tabId !== id);
  const titles = { ...state.titles };
  delete titles[id];
  return { ids, titles };
}

export function nextTabAfterClose(
  state: NativeWorkspaceTabsState,
  closedId: string
): string | null {
  const idx = state.ids.indexOf(closedId);
  if (idx === -1) return null;
  const remaining = state.ids.filter((id) => id !== closedId);
  return remaining[idx] ?? remaining[idx - 1] ?? null;
}
