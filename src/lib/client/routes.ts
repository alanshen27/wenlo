// Centralized route builders for the app. Grouped by area so views import from a
// single, predictable source instead of hand-assembling URL strings.

import { STORAGE_KEYS, readStorageItem, writeStorageItem } from "@/lib/client/storage-keys";

/** @deprecated Use `STORAGE_KEYS.activeLibraryId`. */
export const LIBRARY_STORAGE_KEY = STORAGE_KEYS.activeLibraryId;

// ---------------------------------------------------------------------------
// Library + folders
// ---------------------------------------------------------------------------

export function libraryHome(libraryId: string) {
  return `/library/${libraryId}`;
}

export function folderHome(libraryId: string, folderId: string) {
  return `/library/${libraryId}/folder/${folderId}`;
}

// ---------------------------------------------------------------------------
// Content items
// ---------------------------------------------------------------------------

export function pageRoute(libraryId: string, pageId: string) {
  return `/library/${libraryId}/pages/${pageId}`;
}

export function documentRoute(libraryId: string, documentId: string) {
  return `/library/${libraryId}/documents/${documentId}`;
}

export function boardRoute(libraryId: string, boardId: string) {
  return `/library/${libraryId}/boards/${boardId}`;
}

export function deckRoute(libraryId: string, deckId: string) {
  return `/library/${libraryId}/decks/${deckId}`;
}

export function databaseRoute(libraryId: string, databaseId: string) {
  return `/library/${libraryId}/databases/${databaseId}`;
}

export function flowchartRoute(libraryId: string, flowchartId: string) {
  return `/library/${libraryId}/flowcharts/${flowchartId}`;
}

/** Type-aware open target for a document row/card. */
export function documentOpenRoute(libraryId: string, documentId: string, type?: string) {
  if (type === "WHITEBOARD") return boardRoute(libraryId, documentId);
  if (type === "DECK") return deckRoute(libraryId, documentId);
  if (type === "DATABASE") return databaseRoute(libraryId, documentId);
  if (type === "FLOWCHART") return flowchartRoute(libraryId, documentId);
  return documentRoute(libraryId, documentId);
}

// ---------------------------------------------------------------------------
// Native-type hubs (Word-style home + full-screen editors), library-agnostic
// ---------------------------------------------------------------------------

import type { NativeKind } from "@/lib/native/native-types";

/** Word-style home page for a native type, e.g. `/pages`, `/decks`. */
export function nativeHomeRoute(kind: NativeKind) {
  return `/${kind}`;
}

/** Template picker for a native type, e.g. `/pages/templates`. */
export function nativeTemplatesRoute(kind: NativeKind) {
  return `/${kind}/templates`;
}

/** Standalone full-screen editor for a native item, e.g. `/pages/abc123`. */
export function nativeEditorRoute(kind: NativeKind, id: string) {
  return `/${kind}/${id}`;
}

// ---------------------------------------------------------------------------
// Library features (search + recall)
// ---------------------------------------------------------------------------

export function searchRoute(libraryId: string) {
  return `/library/${libraryId}/search`;
}

export function recallRoute(libraryId: string) {
  return `/library/${libraryId}/recall`;
}

export function recallChatRoute(libraryId: string, sessionId?: string | null) {
  const base = recallRoute(libraryId);
  if (!sessionId) return base;
  return `${base}?session=${encodeURIComponent(sessionId)}`;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function settingsRoute() {
  return "/settings";
}

export function settingsIntegrationsRoute() {
  return "/settings/integrations";
}

export function settingsPlanRoute() {
  return "/settings/plan";
}

export function onboardingRoute() {
  return "/onboarding";
}

// ---------------------------------------------------------------------------
// Standalone pages
// ---------------------------------------------------------------------------

export function inviteRoute(token: string) {
  return `/invite/${token}`;
}

export function designSystemRoute() {
  return "/design";
}

// ---------------------------------------------------------------------------
// Active library persistence
// ---------------------------------------------------------------------------

export function persistActiveLibrary(libraryId: string) {
  writeStorageItem(STORAGE_KEYS.activeLibraryId, libraryId);
}

export function readStoredLibraryId() {
  return readStorageItem(STORAGE_KEYS.activeLibraryId);
}
