"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import {
  LibraryContext,
  type LibraryContextValue,
} from "@/components/library/library-shell";
import { StandaloneTopBar } from "@/components/native/standalone-top-bar";
import { FileArtwork } from "@/lib/client/file-icons";
import type { SaveStatus } from "@/components/library/main-header";
import { apiGet } from "@/lib/client/api";
import { NATIVE_TYPES, type NativeKind } from "@/lib/native/native-types";
import { nativeHomeRoute } from "@/lib/client/routes";
import type { LibraryRole } from "@/lib/library/library-access";
import type { PageCollaborator } from "@/lib/realtime/page-presence";

type HeaderState = {
  saveStatus?: SaveStatus;
  titleOverride?: string;
  folderIdFallback?: string | null;
  collaborators?: PageCollaborator[];
  remoteNotice?: string | null;
};

type Resolved = { libraryId: string; canEdit: boolean };

/**
 * Renders an existing library editor (PageView, DeckView, …) full screen,
 * outside the library sidebar/shell. The editors read `useLibrary()` for the
 * library id + permissions and push title/save state via `setHeader`, so we
 * resolve the item's library, then supply a matching `LibraryContext` and a
 * minimal top bar driven by those header updates.
 */
export function StandaloneShell({
  kind,
  children,
}: {
  kind: NativeKind;
  children: ReactNode;
}) {
  const cfg = NATIVE_TYPES[kind];
  const params = useParams<Record<string, string>>();
  const itemId = params[cfg.paramKey];

  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [missing, setMissing] = useState(false);
  const [header, setHeader] = useState<HeaderState>({});

  useEffect(() => {
    let cancelled = false;
    setResolved(null);
    setMissing(false);
    setHeader({});
    void (async () => {
      try {
        const endpoint =
          cfg.source === "page"
            ? `/api/pages/${itemId}`
            : `/api/documents/${itemId}`;
        const [item, libraries] = await Promise.all([
          apiGet<{ libraryId: string }>(endpoint),
          apiGet<Array<{ id: string; role?: LibraryRole }>>("/api/libraries"),
        ]);
        if (cancelled) return;
        const role = libraries.find((l) => l.id === item.libraryId)?.role ?? "OWNER";
        setResolved({ libraryId: item.libraryId, canEdit: role !== "VIEWER" });
      } catch {
        // Missing, inaccessible, or transient — show a standalone "not found"
        // with a path back to the hub rather than bouncing into the library.
        if (!cancelled) setMissing(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [itemId, cfg.source]);

  const setHeaderState = useCallback((state: HeaderState) => setHeader(state), []);
  const asyncNoop = useCallback(async () => {}, []);
  const noop = useCallback(() => {}, []);

  const contextValue = useMemo<LibraryContextValue | null>(() => {
    if (!resolved) return null;
    const role: LibraryRole = resolved.canEdit ? "OWNER" : "VIEWER";
    return {
      libraryId: resolved.libraryId,
      libraries: [],
      activeLibrary: undefined,
      libraryRole: role,
      canEdit: resolved.canEdit,
      tree: [],
      treeLoaded: true,
      folders: [],
      contextFolderId: header.folderIdFallback ?? null,
      refreshTree: asyncNoop,
      uploadToFolder: asyncNoop,
      reindexDocument: asyncNoop,
      breadcrumbHref: () => null,
      setHeader: setHeaderState,
      createPage: asyncNoop,
      createBoard: asyncNoop,
      createDeck: asyncNoop,
      createDatabase: asyncNoop,
      createFlowchart: asyncNoop,
      moveItem: asyncNoop,
      beginCreateFolder: noop,
      beginEditFolder: noop,
      beginDeleteFolder: noop,
      beginDeletePage: noop,
      beginDeleteDocument: noop,
      beginMove: noop,
      openDocumentPreview: noop,
      closeDocumentPreview: noop,
    };
  }, [resolved, header.folderIdFallback, asyncNoop, noop, setHeaderState]);

  if (missing) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <FileArtwork type={cfg.artworkType} className="size-12" />
        <div>
          <h1 className="text-lg font-semibold">{cfg.label} not found</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            It may have been moved or deleted.
          </p>
        </div>
        <Link
          href={nativeHomeRoute(kind)}
          className="rounded-md bg-foreground px-3.5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          Back to {cfg.plural}
        </Link>
      </div>
    );
  }

  if (!contextValue) {
    return (
      <div className="flex h-screen flex-col bg-background">
        <StandaloneTopBar kind={kind} title="" />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <LibraryContext.Provider value={contextValue}>
      <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
        <StandaloneTopBar
          kind={kind}
          title={header.titleOverride ?? ""}
          saveStatus={header.saveStatus}
          collaborators={header.collaborators}
          remoteNotice={header.remoteNotice}
        />
        <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
      </div>
    </LibraryContext.Provider>
  );
}
