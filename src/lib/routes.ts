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

export function searchRoute(libraryId: string) {
  return `/library/${libraryId}/search`;
}

export function recallRoute(libraryId: string) {
  return `/library/${libraryId}/recall`;
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
