"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePersistentState } from "@/lib/client/use-persistent-state";
import { nativeEditorRoute, nativeHomeRoute } from "@/lib/client/routes";
import { createBlankNative } from "@/lib/native/create-from-template";
import type { LibraryPickerOptions } from "@/hooks/use-library-picker";
import {
  EMPTY_NATIVE_WORKSPACE_TABS,
  nativeWorkspaceTabsStorageKey,
  nextTabAfterClose,
  normalizeNativeWorkspaceTabs,
  removeNativeWorkspaceTab,
  upsertNativeWorkspaceTab,
} from "@/lib/native/native-workspace-tabs-storage";
import { NATIVE_TYPES, type NativeKind } from "@/lib/native/native-types";

export type NativeWorkspaceTab = {
  id: string;
  title: string;
};

export function useNativeWorkspaceTabs(
  kind: NativeKind,
  activeId: string,
  activeTitle: string
) {
  const router = useRouter();
  const storageKey = nativeWorkspaceTabsStorageKey(kind);
  const [state, setState, hydrated] = usePersistentState(
    storageKey,
    EMPTY_NATIVE_WORKSPACE_TABS
  );

  useEffect(() => {
    if (!hydrated || !activeId) return;
    setState((prev) => {
      const normalized = normalizeNativeWorkspaceTabs(prev);
      return upsertNativeWorkspaceTab(normalized, activeId, activeTitle);
    });
  }, [hydrated, activeId, activeTitle, setState]);

  const tabs: NativeWorkspaceTab[] = normalizeNativeWorkspaceTabs(state).ids.map((id) => ({
    id,
    title: state.titles[id]?.trim() || "Untitled",
  }));

  const selectTab = useCallback(
    (id: string) => {
      if (id !== activeId) router.push(nativeEditorRoute(kind, id));
    },
    [activeId, kind, router]
  );

  const closeTab = useCallback(
    (id: string) => {
      let nextRoute: string | null = null;
      setState((prev) => {
        const normalized = normalizeNativeWorkspaceTabs(prev);
        if (id === activeId) {
          const nextId = nextTabAfterClose(normalized, id);
          nextRoute = nextId ? nativeEditorRoute(kind, nextId) : nativeHomeRoute(kind);
        }
        return removeNativeWorkspaceTab(normalized, id);
      });
      if (nextRoute) router.push(nextRoute);
    },
    [activeId, kind, router, setState]
  );

  return { tabs, activeId, selectTab, closeTab, hydrated };
}

export function useNativeWorkspaceAdd(
  kind: NativeKind,
  pickLibrary: (options: LibraryPickerOptions) => Promise<string | null>,
  defaultLibraryId?: string | null,
  hasLibraries = true
) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const cfg = NATIVE_TYPES[kind];

  const addWorkspace = useCallback(async () => {
    if (!cfg.creatable || !hasLibraries || adding) return;
    const libraryId = await pickLibrary({
      title: `Choose library for new ${cfg.label.toLowerCase()}`,
      description: `A new ${cfg.label.toLowerCase()} will be created in this library.`,
      confirmLabel: cfg.newLabel,
      defaultLibraryId,
    });
    if (!libraryId) return;
    setAdding(true);
    try {
      const id = await createBlankNative(kind, libraryId);
      router.push(nativeEditorRoute(kind, id));
    } catch {
      setAdding(false);
    }
  }, [
    adding,
    cfg.creatable,
    cfg.label,
    cfg.newLabel,
    defaultLibraryId,
    hasLibraries,
    kind,
    pickLibrary,
    router,
  ]);

  return {
    addWorkspace,
    adding,
    addLabel: cfg.newLabel,
    canAdd: cfg.creatable && hasLibraries,
  };
}
