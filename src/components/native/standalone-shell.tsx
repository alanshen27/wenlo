"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { LibraryProviders, type HeaderState } from "@/components/library/context";
import { NativeAppShell } from "@/components/native/native-app-shell";
import { NativeTopBar } from "@/components/native/native-top-bar";
import { FileArtwork } from "@/lib/client/file-icons";
import { apiGet } from "@/lib/client/api";
import { NATIVE_TYPES, type NativeKind } from "@/lib/native/native-types";
import { nativeHomeRoute } from "@/lib/client/routes";
import type { LibraryRole } from "@/lib/library/library-access";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";

type Resolved = { libraryId: string; canEdit: boolean };

const noop = () => {};
const asyncNoop = async () => {};

/**
 * Renders a native editor full-screen outside the library sidebar.
 * Provides minimal split library contexts so editors can call
 * `useLibraryScope`, `useLibraryHeader`, and `useLibraryTree` without the
 * full shell or a brittle god-context stub.
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
          cfg.source === "page" ? `/api/pages/${itemId}` : `/api/documents/${itemId}`;
        const [item, libraries] = await Promise.all([
          apiGet<{ libraryId: string }>(endpoint),
          apiGet<Array<{ id: string; role?: LibraryRole }>>("/api/libraries"),
        ]);
        if (cancelled) return;
        const role = libraries.find((l) => l.id === item.libraryId)?.role ?? "OWNER";
        setResolved({ libraryId: item.libraryId, canEdit: role !== "VIEWER" });
      } catch {
        if (!cancelled) setMissing(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [itemId, cfg.source]);

  const setHeaderState = useCallback((state: HeaderState) => setHeader(state), []);

  const providers = useMemo(() => {
    if (!resolved) return null;
    const role: LibraryRole = resolved.canEdit ? "OWNER" : "VIEWER";
    return {
      scope: {
        libraryId: resolved.libraryId,
        libraries: [],
        activeLibrary: undefined,
        libraryRole: role,
        canEdit: resolved.canEdit,
        contextFolderId: header.folderIdFallback ?? null,
      },
      tree: {
        tree: [],
        treeLoaded: true,
        folders: [],
        refreshTree: asyncNoop,
        uploadToFolder: asyncNoop,
        reindexDocument: asyncNoop,
        breadcrumbHref: () => null,
        moveItem: asyncNoop,
        moveEntriesToFolder: asyncNoop,
      },
      actions: {
        createPage: asyncNoop,
        createBoard: asyncNoop,
        createDeck: asyncNoop,
        createDatabase: asyncNoop,
        createFlowchart: asyncNoop,
        beginCreateFolder: noop,
        beginEditFolder: noop,
        beginDeleteFolder: noop,
        beginDeletePage: noop,
        beginDeleteDocument: noop,
        beginMove: noop,
        openDocumentPreview: noop,
        closeDocumentPreview: noop,
        openLibraryCreate: noop,
        openLibraryEdit: noop,
        openLibraryDelete: noop,
        openShareLibrary: noop,
      },
      header: { setHeader: setHeaderState },
    };
  }, [resolved, header.folderIdFallback, setHeaderState]);

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

  if (!providers) {
    return (
      <NativeAppShell
        kind={kind}
        topBar={(shell) => (
          <NativeTopBar
            mode="editor"
            kind={kind}
            workspaceId={itemId}
            title=""
            sidebarCollapsed={shell.sidebarCollapsed}
            onToggleSidebar={shell.toggleSidebar}
          />
        )}
      >
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </NativeAppShell>
    );
  }

  return (
    <LibraryProviders {...providers}>
      <NativeAppShell
        kind={kind}
        preferredLibraryId={providers.scope.libraryId}
        topBar={(shell) => (
          <NativeTopBar
            mode="editor"
            kind={kind}
            workspaceId={itemId}
            title={header.titleOverride ?? ""}
            libraryId={providers.scope.libraryId}
            saveStatus={header.saveStatus}
            collaborators={header.collaborators}
            remoteNotice={header.remoteNotice}
            sidebarCollapsed={shell.sidebarCollapsed}
            onToggleSidebar={shell.toggleSidebar}
          />
        )}
      >
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
      </NativeAppShell>
    </LibraryProviders>
  );
}
