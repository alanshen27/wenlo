export const LIBRARY_STORAGE_KEY = "recall:activeLibraryId";

export function libraryHome(libraryId: string) {
  return `/library/${libraryId}`;
}

export function folderHome(libraryId: string, folderId: string) {
  return `/library/${libraryId}/folder/${folderId}`;
}

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

export function mindMapRoute(libraryId: string) {
  return `/library/${libraryId}/map`;
}

export function inviteRoute(token: string) {
  return `/invite/${token}`;
}

export function settingsRoute() {
  return "/settings";
}

export function settingsIntegrationsRoute() {
  return "/settings/integrations";
}

export function settingsPlanRoute() {
  return "/settings/plan";
}

export function persistActiveLibrary(libraryId: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem(LIBRARY_STORAGE_KEY, libraryId);
  }
}

export function readStoredLibraryId() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LIBRARY_STORAGE_KEY);
}
