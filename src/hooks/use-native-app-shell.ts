"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Library } from "@/components/sidebar/library-switcher";
import { useLibraries, useUpsertLibrary } from "@/hooks/use-libraries";
import { useLibraryPicker } from "@/hooks/use-library-picker";
import { apiPost } from "@/lib/client/api";
import { createBlankNative } from "@/lib/native/create-from-template";
import { NATIVE_TYPES, type NativeKind } from "@/lib/native/native-types";
import {
  nativeEditorRoute,
  persistActiveLibrary,
  readStoredLibraryId,
} from "@/lib/client/routes";
import { readStorageItem, STORAGE_KEYS } from "@/lib/client/storage-keys";
import { usePersistentState } from "@/lib/client/use-persistent-state";

function readSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = readStorageItem(STORAGE_KEYS.nativeSidebarCollapsed);
    return stored ? (JSON.parse(stored) as boolean) : false;
  } catch {
    return false;
  }
}

export function useNativeAppShell(kind: NativeKind, preferredLibraryId?: string | null) {
  const router = useRouter();
  const cfg = NATIVE_TYPES[kind];
  const { data: libraries = [], isLoading: librariesLoading } = useLibraries();
  const upsertLibrary = useUpsertLibrary();
  const [activeLibraryId, setActiveLibraryId] = useState<string | null>(() => {
    if (typeof window === "undefined") return preferredLibraryId ?? null;
    return preferredLibraryId ?? readStoredLibraryId();
  });
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed, sidebarHydrated] = usePersistentState(
    STORAGE_KEYS.nativeSidebarCollapsed,
    false
  );

  useEffect(() => {
    if (librariesLoading || libraries.length === 0) return;
    setActiveLibraryId((prev) => {
      if (
        preferredLibraryId &&
        libraries.some((library) => library.id === preferredLibraryId)
      ) {
        persistActiveLibrary(preferredLibraryId);
        return preferredLibraryId;
      }
      if (prev && libraries.some((library) => library.id === prev)) return prev;
      const stored = readStoredLibraryId();
      const next =
        stored && libraries.some((library) => library.id === stored)
          ? stored
          : libraries[0].id;
      persistActiveLibrary(next);
      return next;
    });
  }, [libraries, librariesLoading, preferredLibraryId]);

  const selectLibrary = useCallback((id: string) => {
    setActiveLibraryId(id);
    persistActiveLibrary(id);
  }, []);

  const handleCreateLibrary = useCallback(
    async (data: { name: string; icon: string }) => {
      const created = await apiPost<Library>("/api/libraries", data);
      upsertLibrary(created);
      selectLibrary(created.id);
    },
    [selectLibrary, upsertLibrary]
  );

  const libraryPicker = useLibraryPicker(libraries, activeLibraryId);

  const handleCreateBlank = useCallback(async () => {
    if (!cfg.creatable || creatingId || librariesLoading) return;
    const libraryId = await libraryPicker.prompt({
      title: `Choose library for new ${cfg.label.toLowerCase()}`,
      description: `The new ${cfg.label.toLowerCase()} will be created in this library.`,
      confirmLabel: cfg.newLabel,
      defaultLibraryId: activeLibraryId,
    });
    if (!libraryId) return;
    setCreatingId("blank");
    try {
      const id = await createBlankNative(kind, libraryId);
      router.push(nativeEditorRoute(kind, id));
    } catch {
      setCreatingId(null);
    }
  }, [
    activeLibraryId,
    cfg.creatable,
    cfg.label,
    cfg.newLabel,
    creatingId,
    kind,
    librariesLoading,
    libraryPicker,
    router,
  ]);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((collapsed) => !collapsed);
  }, [setSidebarCollapsed]);

  const collapsed = sidebarHydrated ? sidebarCollapsed : readSidebarCollapsed();

  return {
    libraries,
    librariesLoading,
    activeLibraryId,
    creatingId,
    setCreatingId,
    selectLibrary,
    handleCreateLibrary,
    libraryPicker,
    handleCreateBlank,
    sidebarCollapsed: collapsed,
    toggleSidebar,
  };
}

export type NativeAppShellState = ReturnType<typeof useNativeAppShell>;
