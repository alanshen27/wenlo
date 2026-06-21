/**
 * Browser storage keys for wenlo client preferences.
 * Legacy `recall:` / `recalls:` keys are migrated on first read.
 */
export const STORAGE_KEYS = {
  activeLibraryId: "wenlo:activeLibraryId",
  focusMode: "wenlo:focus-mode",
  nativeSidebarCollapsed: "wenlo:native-sidebar-collapsed",
  cloudView: "wenlo:cloud-view",
  cloudSort: "wenlo:cloud-sort",
  dbView: (databaseId: string) => `wenlo:db-view:${databaseId}`,
  /** Open native editor tabs per type (`pages`, `decks`, …). JSON: `{ ids, titles }`. */
  nativeWorkspaceTabs: (kind: string) => `wenlo:native-tabs:${kind}`,
} as const;

const LEGACY_KEY_MAP: Record<string, string> = {
  [STORAGE_KEYS.activeLibraryId]: "recall:activeLibraryId",
  [STORAGE_KEYS.focusMode]: "recalls:focus-mode",
  [STORAGE_KEYS.cloudView]: "recall:cloud-view",
  [STORAGE_KEYS.cloudSort]: "recall:cloud-sort",
};

/** Read a storage value, migrating from legacy recall-prefixed keys when needed. */
export function readStorageItem(key: string): string | null {
  if (typeof window === "undefined") return null;

  const current = window.localStorage.getItem(key);
  if (current !== null) return current;

  const legacyKey = LEGACY_KEY_MAP[key];
  if (!legacyKey) return null;

  const legacy = window.localStorage.getItem(legacyKey);
  if (legacy === null) return null;

  try {
    window.localStorage.setItem(key, legacy);
    window.localStorage.removeItem(legacyKey);
  } catch {
    /* storage full or unavailable — still return migrated value */
  }
  return legacy;
}

/** Persist a string value; silently ignores unavailable storage. */
export function writeStorageItem(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

/** Migrate per-database view keys (`recalls:db-view:*` → `wenlo:db-view:*`). */
export function readDbViewStorageKey(databaseId: string): string {
  const key = STORAGE_KEYS.dbView(databaseId);
  if (typeof window === "undefined") return key;

  const legacyKey = `recalls:db-view:${databaseId}`;
  const legacy = window.localStorage.getItem(legacyKey);
  if (legacy !== null) {
    try {
      window.localStorage.setItem(key, legacy);
      window.localStorage.removeItem(legacyKey);
    } catch {
      /* ignore */
    }
  }
  return key;
}
