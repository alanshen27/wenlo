import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readDbViewStorageKey,
  readStorageItem,
  STORAGE_KEYS,
  writeStorageItem,
} from "./storage-keys";

function createStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
}

describe("readStorageItem", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: createStorage() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the current key when present", () => {
    writeStorageItem(STORAGE_KEYS.activeLibraryId, "lib-1");
    expect(readStorageItem(STORAGE_KEYS.activeLibraryId)).toBe("lib-1");
  });

  it("migrates legacy recall keys on read", () => {
    window.localStorage.setItem("recall:activeLibraryId", "legacy-lib");
    expect(readStorageItem(STORAGE_KEYS.activeLibraryId)).toBe("legacy-lib");
    expect(window.localStorage.getItem(STORAGE_KEYS.activeLibraryId)).toBe("legacy-lib");
    expect(window.localStorage.getItem("recall:activeLibraryId")).toBeNull();
  });
});

describe("readDbViewStorageKey", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: createStorage() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("migrates recalls:db-view keys", () => {
    window.localStorage.setItem("recalls:db-view:db-1", "view-1");
    const key = readDbViewStorageKey("db-1");
    expect(key).toBe(STORAGE_KEYS.dbView("db-1"));
    expect(window.localStorage.getItem(key)).toBe("view-1");
    expect(window.localStorage.getItem("recalls:db-view:db-1")).toBeNull();
  });
});
