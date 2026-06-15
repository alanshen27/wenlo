"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { FolderSidebar } from "@/components/sidebar/folder-sidebar";
import type { Library } from "@/components/sidebar/library-switcher";
import { FolderModal } from "@/components/modals/folder-modal";
import { LibraryModal } from "@/components/modals/library-modal";
import { DEFAULT_LIBRARY_ICON } from "@/components/icons/library-icon";
import { ConfirmModal } from "@/components/modals/confirm-modal";
import { MoveModal } from "@/components/modals/move-modal";
import { ShareLibraryModal } from "@/components/modals/share-library-modal";
import { PendingInvitesBanner } from "@/components/library/pending-invites-banner";
import { MainHeader, type SaveStatus } from "@/components/library/main-header";
import { FilePreviewPanel, type PreviewTarget } from "@/components/cloud/file-preview-panel";
import { RecallChatProvider } from "@/components/recall/recall-chat-context";
import { buildRouteBreadcrumbs } from "@/lib/client/route-breadcrumbs";
import { usePersistentState } from "@/lib/client/use-persistent-state";
import type { PageCollaborator } from "@/lib/realtime/page-presence";
import type { BreadcrumbItem, FolderNode } from "@/lib/library/folders";
import type { FolderColorId } from "@/lib/library/folder-colors";
import type { SidebarDragItem } from "@/lib/client/sidebar-dnd";
import {
  addOptimisticDocuments,
  createPendingUploads,
  findItemFolderId,
  findItemInTree,
  moveItemInTree,
  removeOptimisticDocument,
  replaceOptimisticDocument,
  setDocumentProcessing,
  setDocumentStatus,
} from "@/lib/client/tree-mutations";
import { uploadFile } from "@/lib/documents/upload";
import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
} from "@/lib/client/api";
import {
  boardRoute,
  databaseRoute,
  deckRoute,
  documentOpenRoute,
  flowchartRoute,
  folderHome,
  libraryHome,
  pageRoute,
  mindMapRoute,
  persistActiveLibrary,
  recallRoute,
  searchRoute,
} from "@/lib/client/routes";

type FlatFolder = { id: string; name: string; color: string; parentId: string | null };

type Modal =
  | { kind: "none" }
  | { kind: "folder-create"; parentId: string | null }
  | { kind: "folder-edit"; id: string; name: string; color: FolderColorId }
  | { kind: "folder-delete"; id: string; name: string }
  | { kind: "library-create" }
  | { kind: "library-edit"; library: Library }
  | { kind: "library-delete"; library: Library }
  | { kind: "page-delete"; id: string; title: string }
  | { kind: "document-delete"; id: string; title: string }
  | { kind: "move"; item: SidebarDragItem };

type HeaderState = {
  saveStatus?: SaveStatus;
  titleOverride?: string;
  folderIdFallback?: string | null;
  collaborators?: PageCollaborator[];
  remoteNotice?: string | null;
};

type LibraryContextValue = {
  libraryId: string;
  libraries: Library[];
  activeLibrary: Library | undefined;
  libraryRole: Library["role"];
  canEdit: boolean;
  tree: FolderNode[];
  treeLoaded: boolean;
  folders: FlatFolder[];
  contextFolderId: string | null;
  refreshTree: () => Promise<void>;
  uploadToFolder: (folderId: string | null, files: FileList | File[]) => Promise<void>;
  reindexDocument: (documentId: string) => Promise<void>;
  breadcrumbHref: (item: BreadcrumbItem) => string | null;
  setHeader: (state: HeaderState) => void;
  createPage: (folderId: string | null) => Promise<void>;
  createBoard: (folderId: string | null) => Promise<void>;
  createDeck: (folderId: string | null) => Promise<void>;
  createDatabase: (folderId: string | null) => Promise<void>;
  createFlowchart: (folderId: string | null) => Promise<void>;
  moveItem: (item: SidebarDragItem, folderId: string | null) => Promise<void>;
  beginCreateFolder: (parentId: string | null) => void;
  beginEditFolder: (folder: { id: string; name: string; color: FolderColorId }) => void;
  beginDeleteFolder: (folder: { id: string; name: string }) => void;
  beginDeletePage: (page: { id: string; title: string }) => void;
  beginDeleteDocument: (doc: { id: string; title: string }) => void;
  beginMove: (item: SidebarDragItem) => void;
  openDocumentPreview: (target: PreviewTarget) => void;
  closeDocumentPreview: () => void;
};

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used within LibraryShell");
  return ctx;
}

export function LibraryShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{
    libraryId: string;
    folderId?: string;
    pageId?: string;
    documentId?: string;
    boardId?: string;
  }>();

  const libraryId = params.libraryId;
  const selectedFolderId = params.folderId ?? null;
  const selectedPageId = params.pageId ?? null;
  // Boards are documents; treat the board id as the active document for
  // breadcrumb / context-folder / selection purposes.
  const selectedDocumentId = params.documentId ?? params.boardId ?? null;

  const [libraries, setLibraries] = useState<Library[]>([]);
  const [tree, setTree] = useState<FolderNode[]>([]);
  const [loadedLibraryId, setLoadedLibraryId] = useState<string | null>(null);
  const [folders, setFolders] = useState<FlatFolder[]>([]);
  const [contextFolderId, setContextFolderId] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>({ kind: "none" });
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [header, setHeader] = useState<HeaderState>({});
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget | null>(null);
  const [focusMode, setFocusMode] = usePersistentState<boolean>(
    "recalls:focus-mode",
    false
  );

  const activeLibrary = libraries.find((l) => l.id === libraryId);
  const libraryRole = activeLibrary?.role ?? "OWNER";
  const canEdit = libraryRole !== "VIEWER";
  const isSearchPage = pathname.endsWith("/search");
  const isRecallPage = pathname.endsWith("/recall");
  const isMapPage = pathname.endsWith("/map");
  const isFilesHome =
    !isSearchPage && !isRecallPage && !isMapPage && !selectedPageId && !selectedDocumentId;
  const activeNav = isSearchPage
    ? "search"
    : isRecallPage
      ? "recall"
      : isMapPage
        ? "map"
        : isFilesHome
          ? "home"
          : null;

  useEffect(() => {
    if (selectedFolderId) {
      setContextFolderId(selectedFolderId);
      return;
    }
    if (selectedPageId) {
      const folderId = findItemFolderId(tree, { type: "page", id: selectedPageId });
      if (folderId !== undefined) setContextFolderId(folderId);
      return;
    }
    if (selectedDocumentId) {
      const item = findItemInTree(tree, { type: "document", id: selectedDocumentId });
      if (item) setContextFolderId(item.folderId);
    }
  }, [selectedFolderId, selectedPageId, selectedDocumentId, tree]);

  const refreshTree = useCallback(async () => {
    if (!libraryId) return;
    try {
      const data = await apiGet<{ tree: FolderNode[]; folders: FlatFolder[] }>(
        `/api/folders?libraryId=${libraryId}`
      );
      setTree(data.tree);
      setFolders(data.folders);
    } catch {
      /* noop */
    } finally {
      setLoadedLibraryId(libraryId);
    }
  }, [libraryId]);

  // Derived so switching libraries shows the skeleton again without an effect,
  // while on-demand refreshes (after create/move/delete) keep content mounted.
  const treeLoaded = loadedLibraryId === libraryId;

  const loadLibraries = useCallback(async () => {
    try {
      const data = await apiGet<Library[]>("/api/libraries");
      setLibraries(data);
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    loadLibraries();
  }, [loadLibraries]);

  useEffect(() => {
    if (libraryId) {
      persistActiveLibrary(libraryId);
      refreshTree();
    }
  }, [libraryId, refreshTree]);

  useEffect(() => {
    setHeader({});
    // Close any open file preview when the active view changes.
    setPreviewTarget(null);
  }, [libraryId, selectedFolderId, selectedPageId, selectedDocumentId, isSearchPage, isRecallPage, isMapPage]);

  useEffect(() => {
    if (!focusMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFocusMode(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusMode, setFocusMode]);

  const breadcrumbs = useMemo(() => {
    const libraryName = activeLibrary?.name ?? "Library";

    if (isSearchPage) {
      return [
        { id: "__library__", name: libraryName, type: "library" as const },
        { id: "__search__", name: "Search", type: "search" as const },
      ];
    }

    if (isRecallPage) {
      return [
        { id: "__library__", name: libraryName, type: "library" as const },
        { id: "__recall__", name: "Recall", type: "recall" as const },
      ];
    }

    if (isMapPage) {
      return [
        { id: "__library__", name: libraryName, type: "library" as const },
        { id: "__map__", name: "Mind map", type: "map" as const },
      ];
    }

    return buildRouteBreadcrumbs(
      {
        folderId: selectedFolderId ?? undefined,
        pageId: selectedPageId ?? undefined,
        documentId: selectedDocumentId ?? undefined,
      },
      {
        libraryName,
        folders,
        tree,
      },
      {
        titleOverride: header.titleOverride,
        folderIdFallback: header.folderIdFallback,
      }
    );
  }, [
    activeLibrary?.name,
    folders,
    tree,
    selectedFolderId,
    selectedPageId,
    selectedDocumentId,
    header.titleOverride,
    header.folderIdFallback,
    isSearchPage,
    isRecallPage,
    isMapPage,
  ]);

  useEffect(() => {
    if (libraries.length === 0) return;
    if (!libraries.some((l) => l.id === libraryId)) {
      router.replace(libraryHome(libraries[0].id));
    }
  }, [libraries, libraryId, router]);

  const setHeaderState = useCallback((state: HeaderState) => {
    setHeader(state);
  }, []);

  const breadcrumbHref = useCallback(
    (item: BreadcrumbItem) => {
      switch (item.type) {
        case "library":
          return libraryHome(libraryId);
        case "folder":
          return folderHome(libraryId, item.id);
        case "page":
          return pageRoute(libraryId, item.id);
        case "document": {
          const found = findItemInTree(tree, { type: "document", id: item.id });
          return documentOpenRoute(libraryId, item.id, found?.docType);
        }
        case "search":
          return searchRoute(libraryId);
        case "recall":
          return recallRoute(libraryId);
        case "map":
          return mindMapRoute(libraryId);
        default:
          return null;
      }
    },
    [libraryId, tree]
  );

  const selectLibrary = useCallback(
    (id: string) => {
      persistActiveLibrary(id);
      router.push(libraryHome(id));
    },
    [router]
  );

  const createPage = useCallback(
    async (folderId: string | null) => {
      const data = await apiPost<{ id: string }>("/api/pages", {
        folderId,
        libraryId,
        title: "Untitled",
      });
      await refreshTree();
      router.push(pageRoute(libraryId, data.id));
    },
    [libraryId, refreshTree, router]
  );

  const createBoard = useCallback(
    async (folderId: string | null) => {
      const data = await apiPost<{ id: string }>("/api/documents", {
        type: "WHITEBOARD",
        folderId,
        libraryId,
        title: "Untitled whiteboard",
      });
      await refreshTree();
      router.push(boardRoute(libraryId, data.id));
    },
    [libraryId, refreshTree, router]
  );

  const createDeck = useCallback(
    async (folderId: string | null) => {
      const data = await apiPost<{ id: string }>("/api/documents", {
        type: "DECK",
        folderId,
        libraryId,
        title: "Untitled deck",
      });
      await refreshTree();
      router.push(deckRoute(libraryId, data.id));
    },
    [libraryId, refreshTree, router]
  );

  const createDatabase = useCallback(
    async (folderId: string | null) => {
      const data = await apiPost<{ id: string }>("/api/documents", {
        type: "DATABASE",
        folderId,
        libraryId,
        title: "Untitled database",
      });
      await refreshTree();
      router.push(databaseRoute(libraryId, data.id));
    },
    [libraryId, refreshTree, router]
  );

  const createFlowchart = useCallback(
    async (folderId: string | null) => {
      const data = await apiPost<{ id: string }>("/api/documents", {
        type: "FLOWCHART",
        folderId,
        libraryId,
        title: "Untitled flowchart",
      });
      await refreshTree();
      router.push(flowchartRoute(libraryId, data.id));
    },
    [libraryId, refreshTree, router]
  );

  const beginCreateFolder = useCallback(
    (parentId: string | null) => setModal({ kind: "folder-create", parentId }),
    []
  );

  const beginEditFolder = useCallback(
    (folder: { id: string; name: string; color: FolderColorId }) =>
      setModal({ kind: "folder-edit", id: folder.id, name: folder.name, color: folder.color }),
    []
  );

  const beginDeleteFolder = useCallback(
    (folder: { id: string; name: string }) =>
      setModal({ kind: "folder-delete", id: folder.id, name: folder.name }),
    []
  );

  const beginDeletePage = useCallback(
    (page: { id: string; title: string }) =>
      setModal({ kind: "page-delete", id: page.id, title: page.title }),
    []
  );

  const beginMove = useCallback(
    (item: SidebarDragItem) => setModal({ kind: "move", item }),
    []
  );

  const beginDeleteDocument = useCallback(
    (doc: { id: string; title: string }) =>
      setModal({ kind: "document-delete", id: doc.id, title: doc.title }),
    []
  );

  const openDocumentPreview = useCallback(
    (target: PreviewTarget) => setPreviewTarget(target),
    []
  );

  const closeDocumentPreview = useCallback(() => setPreviewTarget(null), []);

  const moveItem = useCallback(
    async (item: SidebarDragItem, folderId: string | null) => {
      if (!item.title) return;
      const title = item.title;

      let previousTree: FolderNode[] = [];
      setTree((prev) => {
        if (findItemFolderId(prev, item) === folderId) return prev;
        previousTree = prev;
        return moveItemInTree(
          prev,
          {
            type: item.type,
            id: item.id,
            title,
            docType: item.docType,
          },
          folderId
        );
      });

      if (previousTree.length === 0) return;

      const url = item.type === "page" ? `/api/pages/${item.id}` : `/api/documents/${item.id}`;
      try {
        await apiPatch(url, { folderId });
      } catch {
        setTree(previousTree);
      }
    },
    []
  );

  const pollDocumentStatus = useCallback((documentId: string) => {
    let attempts = 0;
    const tick = async () => {
      attempts += 1;
      try {
        const { status } = await apiGet<{ status: string }>(
          `/api/documents/${documentId}/status`
        );
        if (status !== "PROCESSING") {
          setTree((prev) => setDocumentStatus(prev, documentId, status));
          return;
        }
      } catch {
        /* transient — keep polling */
      }
      if (attempts < 60) {
        window.setTimeout(tick, 2000);
      } else {
        setTree((prev) => setDocumentProcessing(prev, documentId, false));
      }
    };
    window.setTimeout(tick, 2000);
  }, []);

  const reindexDocument = useCallback(
    async (documentId: string) => {
      setTree((prev) => setDocumentStatus(prev, documentId, "PROCESSING"));
      try {
        await apiPost(`/api/documents/${documentId}/reindex`, {});
        pollDocumentStatus(documentId);
      } catch {
        setTree((prev) => setDocumentStatus(prev, documentId, "FAILED"));
      }
    },
    [pollDocumentStatus]
  );

  const uploadToFolder = useCallback(
    async (folderId: string | null, files: FileList | File[]) => {
      const fileList = Array.from(files);
      const pending = createPendingUploads(fileList);

      setTree((prev) => addOptimisticDocuments(prev, pending, folderId));

      await Promise.all(
        fileList.map(async (file, index) => {
          const tempId = pending[index].id;
          try {
            const uploaded = await uploadFile({ libraryId, folderId, file });
            const processing = uploaded.status === "PROCESSING";
            setTree((prev) =>
              replaceOptimisticDocument(prev, tempId, {
                ...uploaded,
                processing,
                status: uploaded.status,
              })
            );
            if (processing) pollDocumentStatus(uploaded.id);
          } catch {
            setTree((prev) => removeOptimisticDocument(prev, tempId));
          }
        })
      );
    },
    [libraryId, pollDocumentStatus]
  );

  async function handleFolderSubmit(data: { name: string; color: FolderColorId }) {
    try {
      if (modal.kind === "folder-create") {
        await apiPost("/api/folders", {
          name: data.name,
          color: data.color,
          parentId: modal.parentId,
          libraryId,
        });
      } else if (modal.kind === "folder-edit") {
        await apiPatch(`/api/folders/${modal.id}`, { name: data.name, color: data.color });
      }
    } catch {
      /* noop */
    }
    refreshTree();
  }

  async function handleLibrarySubmit(data: { name: string; icon: string }) {
    try {
      if (modal.kind === "library-create") {
        const library = await apiPost<Library>("/api/libraries", data);
        setLibraries((prev) => [...prev, library]);
        persistActiveLibrary(library.id);
        router.push(libraryHome(library.id));
      } else if (modal.kind === "library-edit") {
        const updated = await apiPatch<Library>(`/api/libraries/${modal.library.id}`, data);
        setLibraries((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      }
    } catch {
      /* noop */
    }
  }

  async function handleConfirmDelete() {
    setDeleteLoading(true);
    try {
      if (modal.kind === "folder-delete") {
        await apiDelete(`/api/folders/${modal.id}`);
        if (selectedFolderId === modal.id) router.push(libraryHome(libraryId));
        refreshTree();
      } else if (modal.kind === "page-delete") {
        await apiDelete(`/api/pages/${modal.id}`);
        if (selectedPageId === modal.id) router.push(libraryHome(libraryId));
        refreshTree();
      } else if (modal.kind === "document-delete") {
        await apiDelete(`/api/documents/${modal.id}`);
        if (selectedDocumentId === modal.id) router.push(libraryHome(libraryId));
        setPreviewTarget((prev) => (prev?.id === modal.id ? null : prev));
        refreshTree();
      } else if (modal.kind === "library-delete") {
        await apiDelete(`/api/libraries/${modal.library.id}`);
        const remaining = libraries.filter((l) => l.id !== modal.library.id);
        setLibraries(remaining);
        const nextId = remaining[0]?.id ?? null;
        if (nextId) {
          persistActiveLibrary(nextId);
          router.push(libraryHome(nextId));
        } else {
          router.push("/");
        }
      }
      setModal({ kind: "none" });
    } finally {
      setDeleteLoading(false);
    }
  }

  const contextValue = useMemo(
    () => ({
      libraryId,
      libraries,
      activeLibrary,
      libraryRole,
      canEdit,
      tree,
      treeLoaded,
      folders,
      contextFolderId,
      refreshTree,
      uploadToFolder,
      reindexDocument,
      breadcrumbHref,
      setHeader: setHeaderState,
      createPage,
      createBoard,
      createDeck,
      createDatabase,
      createFlowchart,
      moveItem,
      beginCreateFolder,
      beginEditFolder,
      beginDeleteFolder,
      beginDeletePage,
      beginDeleteDocument,
      beginMove,
      openDocumentPreview,
      closeDocumentPreview,
    }),
    [
      libraryId,
      libraries,
      activeLibrary,
      libraryRole,
      canEdit,
      tree,
      treeLoaded,
      folders,
      contextFolderId,
      refreshTree,
      uploadToFolder,
      reindexDocument,
      breadcrumbHref,
      setHeaderState,
      createPage,
      createBoard,
      createDeck,
      createDatabase,
      createFlowchart,
      moveItem,
      beginCreateFolder,
      beginEditFolder,
      beginDeleteFolder,
      beginDeletePage,
      beginDeleteDocument,
      beginMove,
      openDocumentPreview,
      closeDocumentPreview,
    ]
  );

  return (
    <LibraryContext.Provider value={contextValue}>
      <RecallChatProvider
        libraryId={libraryId}
        isRecallPage={isRecallPage}
        contextFolderId={contextFolderId}
      >
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        {!focusMode && (
        <FolderSidebar
          libraries={libraries}
          activeLibraryId={libraryId}
          onSelectLibrary={selectLibrary}
          onCreateLibrary={() => setModal({ kind: "library-create" })}
          onShareLibrary={() => setShareOpen(true)}
          onEditLibrary={(library) => setModal({ kind: "library-edit", library })}
          onDeleteLibrary={(library) => setModal({ kind: "library-delete", library })}
          canEdit={canEdit}
          tree={tree}
          treeLoading={!treeLoaded}
          selectedFolderId={selectedFolderId}
          selectedPageId={selectedPageId}
          selectedDocumentId={selectedDocumentId}
          activeNav={activeNav}
          onSelectFolder={(id) => {
            if (id) router.push(folderHome(libraryId, id));
            else router.push(libraryHome(libraryId));
          }}
          onSelectPage={(id) => router.push(pageRoute(libraryId, id))}
          onSelectDocument={(id) => {
            const found = findItemInTree(tree, { type: "document", id });
            router.push(documentOpenRoute(libraryId, id, found?.docType));
          }}
          onCreateFolder={(parentId) => setModal({ kind: "folder-create", parentId })}
          onEditFolder={(folder) =>
            setModal({
              kind: "folder-edit",
              id: folder.id,
              name: folder.name,
              color: folder.color as FolderColorId,
            })
          }
          onDeleteFolder={(folder) =>
            setModal({ kind: "folder-delete", id: folder.id, name: folder.title })
          }
          onCreatePage={createPage}
          onDeletePage={(p) => setModal({ kind: "page-delete", id: p.id, title: p.title })}
          onDeleteDocument={(d) => setModal({ kind: "document-delete", id: d.id, title: d.title })}
          onMoveItem={moveItem}
          onUploadToFolder={uploadToFolder}
          onOpenHome={() => router.push(libraryHome(libraryId))}
          onOpenSearch={() => router.push(searchRoute(libraryId))}
          onOpenRecall={() => router.push(recallRoute(libraryId))}
          onOpenMindMap={() => router.push(mindMapRoute(libraryId))}
        />
        )}

        <main className="flex flex-1 flex-col overflow-hidden">
          <PendingInvitesBanner onAccepted={loadLibraries} />
          <MainHeader
            breadcrumbs={breadcrumbs}
            hrefFor={breadcrumbHref}
            saveStatus={header.saveStatus}
            collaborators={header.collaborators}
            remoteNotice={header.remoteNotice}
            focusMode={focusMode}
            onToggleFocus={() => setFocusMode((prev) => !prev)}
          />
          {children}
        </main>

        {previewTarget && (
          <FilePreviewPanel
            target={previewTarget}
            libraryId={libraryId}
            onClose={closeDocumentPreview}
          />
        )}

        <FolderModal
          open={modal.kind === "folder-create" || modal.kind === "folder-edit"}
          mode={modal.kind === "folder-edit" ? "edit" : "create"}
          initialName={modal.kind === "folder-edit" ? modal.name : ""}
          initialColor={modal.kind === "folder-edit" ? modal.color : "yellow"}
          onOpenChange={(open) => !open && setModal({ kind: "none" })}
          onSubmit={handleFolderSubmit}
        />

        <LibraryModal
          open={modal.kind === "library-create" || modal.kind === "library-edit"}
          mode={modal.kind === "library-edit" ? "edit" : "create"}
          initialName={modal.kind === "library-edit" ? modal.library.name : ""}
          initialIcon={modal.kind === "library-edit" ? modal.library.icon : DEFAULT_LIBRARY_ICON}
          onOpenChange={(open) => !open && setModal({ kind: "none" })}
          onSubmit={handleLibrarySubmit}
        />

        <ConfirmModal
          open={
            modal.kind === "folder-delete" ||
            modal.kind === "page-delete" ||
            modal.kind === "document-delete" ||
            modal.kind === "library-delete"
          }
          title={
            modal.kind === "folder-delete"
              ? "Delete folder?"
              : modal.kind === "page-delete"
                ? "Delete page?"
                : modal.kind === "document-delete"
                  ? "Delete file?"
                  : modal.kind === "library-delete"
                    ? "Delete library?"
                    : ""
          }
          description={
            modal.kind === "folder-delete"
              ? `"${modal.name}" and everything inside it will be permanently deleted.`
              : modal.kind === "page-delete"
                ? `"${modal.title}" will be permanently deleted.`
                : modal.kind === "document-delete"
                  ? `"${modal.title}" will be permanently deleted.`
                  : modal.kind === "library-delete"
                    ? `"${modal.library.name}" and all its folders, pages, and files will be permanently deleted.`
                    : ""
          }
          loading={deleteLoading}
          onOpenChange={(open) => !open && setModal({ kind: "none" })}
          onConfirm={handleConfirmDelete}
        />

        <MoveModal
          open={modal.kind === "move"}
          item={modal.kind === "move" ? modal.item : null}
          folders={folders}
          currentFolderId={
            modal.kind === "move" ? (findItemFolderId(tree, modal.item) ?? null) : null
          }
          libraryName={activeLibrary?.name ?? "Library"}
          onOpenChange={(open) => !open && setModal({ kind: "none" })}
          onMove={async (folderId) => {
            if (modal.kind !== "move") return;
            await moveItem(modal.item, folderId);
            setModal({ kind: "none" });
          }}
        />

        {activeLibrary && (
          <ShareLibraryModal
            open={shareOpen}
            libraryId={libraryId}
            libraryName={activeLibrary.name}
            onOpenChange={setShareOpen}
          />
        )}
      </div>
      </RecallChatProvider>
    </LibraryContext.Provider>
  );
}
