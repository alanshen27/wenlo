"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { FolderSidebar } from "@/components/sidebar/folder-sidebar";
import { FolderModal } from "@/components/modals/folder-modal";
import { LibraryModal } from "@/components/modals/library-modal";
import { DEFAULT_LIBRARY_ICON } from "@/components/icons/library-icon";
import { ConfirmModal } from "@/components/modals/confirm-modal";
import { MoveModal } from "@/components/modals/move-modal";
import { ShareLibraryModal } from "@/components/modals/share-library-modal";
import { PendingInvitesBanner } from "@/components/library/pending-invites-banner";
import { MainHeader } from "@/components/library/main-header";
import { FilePreviewPanel } from "@/components/cloud/file-preview-panel";
import { RecallChatProvider } from "@/components/recall/recall-chat-context";
import { LibraryProviders, type HeaderState } from "@/components/library/context";
import {
  useLibraryCreateActions,
  useLibraryModals,
  useLibraryPreview,
} from "@/components/library/use-library-modals";
import { useLibraries, useInvalidateLibraries } from "@/hooks/use-libraries";
import { useLibraryTreeMutations } from "@/hooks/use-library-tree";
import { buildRouteBreadcrumbs } from "@/lib/client/route-breadcrumbs";
import { STORAGE_KEYS } from "@/lib/client/storage-keys";
import { usePersistentState } from "@/lib/client/use-persistent-state";
import { findItemFolderId } from "@/lib/client/tree-mutations";
import { findItemInTree } from "@/lib/client/tree-mutations";
import { libraryHome, persistActiveLibrary } from "@/lib/client/routes";

export type { HeaderState } from "@/components/library/context";

/**
 * Authenticated library layout: sidebar, header, folder tree, modals, and
 * split React contexts for scope / tree / actions / header state.
 */
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
  const selectedDocumentId = params.documentId ?? params.boardId ?? null;

  const { data: libraries = [] } = useLibraries();
  const invalidateLibraries = useInvalidateLibraries();
  const treeState = useLibraryTreeMutations({ libraryId });
  const { previewTarget, openDocumentPreview, closeDocumentPreview, closePreviewIfDocument } =
    useLibraryPreview();

  const modals = useLibraryModals({
    libraryId,
    libraries,
    refreshTree: treeState.refreshTree,
    selectedFolderId,
    selectedPageId,
    selectedDocumentId,
    onPreviewCloseForDocument: closePreviewIfDocument,
  });

  const createActions = useLibraryCreateActions(libraryId, treeState.refreshTree);

  const [contextFolderId, setContextFolderId] = useState<string | null>(null);
  const [header, setHeader] = useState<HeaderState>({});
  const [focusMode, setFocusMode] = usePersistentState<boolean>(
    STORAGE_KEYS.focusMode,
    false
  );

  const activeLibrary = libraries.find((l) => l.id === libraryId);
  const libraryRole = activeLibrary?.role ?? "OWNER";
  const canEdit = libraryRole !== "VIEWER";
  const isSearchPage = pathname.endsWith("/search");
  const isRecallPage = pathname.endsWith("/recall");

  useEffect(() => {
    if (libraryId) persistActiveLibrary(libraryId);
  }, [libraryId]);

  useEffect(() => {
    if (selectedFolderId) {
      setContextFolderId(selectedFolderId);
      return;
    }
    if (selectedPageId) {
      const folderId = findItemFolderId(treeState.tree, { kind: "page", id: selectedPageId });
      if (folderId !== undefined) setContextFolderId(folderId);
      return;
    }
    if (selectedDocumentId) {
      const item = findItemInTree(treeState.tree, { kind: "document", id: selectedDocumentId });
      if (item) setContextFolderId(item.folderId);
    }
  }, [selectedFolderId, selectedPageId, selectedDocumentId, treeState.tree]);

  useEffect(() => {
    setHeader({});
    closeDocumentPreview();
  }, [
    libraryId,
    selectedFolderId,
    selectedPageId,
    selectedDocumentId,
    isSearchPage,
    isRecallPage,
    closeDocumentPreview,
  ]);

  useEffect(() => {
    if (!focusMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFocusMode(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusMode, setFocusMode]);

  useEffect(() => {
    if (libraries.length === 0) return;
    if (!libraries.some((l) => l.id === libraryId)) {
      router.replace(libraryHome(libraries[0].id));
    }
  }, [libraries, libraryId, router]);

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

    return buildRouteBreadcrumbs(
      {
        folderId: selectedFolderId ?? undefined,
        pageId: selectedPageId ?? undefined,
        documentId: selectedDocumentId ?? undefined,
      },
      {
        libraryName,
        folders: treeState.folders,
        tree: treeState.tree,
      },
      {
        titleOverride: header.titleOverride,
        folderIdFallback: header.folderIdFallback,
      }
    );
  }, [
    activeLibrary?.name,
    treeState.folders,
    treeState.tree,
    selectedFolderId,
    selectedPageId,
    selectedDocumentId,
    header.titleOverride,
    header.folderIdFallback,
    isSearchPage,
    isRecallPage,
  ]);

  const setHeaderState = useCallback((state: HeaderState) => {
    setHeader(state);
  }, []);

  const scopeValue = useMemo(
    () => ({
      libraryId,
      libraries,
      activeLibrary,
      libraryRole,
      canEdit,
      contextFolderId,
    }),
    [libraryId, libraries, activeLibrary, libraryRole, canEdit, contextFolderId]
  );

  const treeValue = useMemo(
    () => ({
      tree: treeState.tree,
      treeLoaded: treeState.treeLoaded,
      folders: treeState.folders,
      refreshTree: treeState.refreshTree,
      uploadToFolder: treeState.uploadToFolder,
      reindexDocument: treeState.reindexDocument,
      breadcrumbHref: treeState.breadcrumbHref,
      moveItem: treeState.moveItem,
      moveEntriesToFolder: treeState.moveEntriesToFolder,
    }),
    [treeState]
  );

  const actionsValue = useMemo(
    () => ({
      ...createActions,
      beginCreateFolder: modals.beginCreateFolder,
      beginEditFolder: modals.beginEditFolder,
      beginDeleteFolder: modals.beginDeleteFolder,
      beginDeletePage: modals.beginDeletePage,
      beginDeleteDocument: modals.beginDeleteDocument,
      beginMove: modals.beginMove,
      openDocumentPreview,
      closeDocumentPreview,
      openLibraryCreate: modals.openLibraryCreate,
      openLibraryEdit: modals.openLibraryEdit,
      openLibraryDelete: modals.openLibraryDelete,
      openShareLibrary: modals.openShareLibrary,
    }),
    [createActions, modals, openDocumentPreview, closeDocumentPreview]
  );

  const headerValue = useMemo(() => ({ setHeader: setHeaderState }), [setHeaderState]);

  const layout = (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {!focusMode ? <FolderSidebar /> : null}

      <main className="flex flex-1 flex-col overflow-hidden">
        <PendingInvitesBanner onAccepted={invalidateLibraries} />
        <MainHeader
          breadcrumbs={breadcrumbs}
          hrefFor={treeState.breadcrumbHref}
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
        open={modals.modal.kind === "folder-create" || modals.modal.kind === "folder-edit"}
        mode={modals.modal.kind === "folder-edit" ? "edit" : "create"}
        initialName={modals.modal.kind === "folder-edit" ? modals.modal.name : ""}
        initialColor={modals.modal.kind === "folder-edit" ? modals.modal.color : "yellow"}
        onOpenChange={(open) => !open && modals.closeModal()}
        onSubmit={modals.handleFolderSubmit}
      />

      <LibraryModal
        open={modals.modal.kind === "library-create" || modals.modal.kind === "library-edit"}
        mode={modals.modal.kind === "library-edit" ? "edit" : "create"}
        initialName={modals.modal.kind === "library-edit" ? modals.modal.library.name : ""}
        initialIcon={
          modals.modal.kind === "library-edit"
            ? modals.modal.library.icon
            : DEFAULT_LIBRARY_ICON
        }
        onOpenChange={(open) => !open && modals.closeModal()}
        onSubmit={modals.handleLibrarySubmit}
      />

      <ConfirmModal
        open={
          modals.modal.kind === "folder-delete" ||
          modals.modal.kind === "page-delete" ||
          modals.modal.kind === "document-delete" ||
          modals.modal.kind === "library-delete"
        }
        title={
          modals.modal.kind === "folder-delete"
            ? "Delete folder?"
            : modals.modal.kind === "page-delete"
              ? "Delete page?"
              : modals.modal.kind === "document-delete"
                ? "Delete file?"
                : modals.modal.kind === "library-delete"
                  ? "Delete library?"
                  : ""
        }
        description={
          modals.modal.kind === "folder-delete"
            ? `"${modals.modal.name}" and everything inside it will be permanently deleted.`
            : modals.modal.kind === "page-delete"
              ? `"${modals.modal.title}" will be permanently deleted.`
              : modals.modal.kind === "document-delete"
                ? `"${modals.modal.title}" will be permanently deleted.`
                : modals.modal.kind === "library-delete"
                  ? `"${modals.modal.library.name}" and all its folders, pages, and files will be permanently deleted.`
                  : ""
        }
        loading={modals.deleteLoading}
        onOpenChange={(open) => !open && modals.closeModal()}
        onConfirm={modals.handleConfirmDelete}
      />

      <MoveModal
        open={modals.modal.kind === "move"}
        item={modals.modal.kind === "move" ? modals.modal.item : null}
        folders={treeState.folders}
        currentFolderId={
          modals.modal.kind === "move"
            ? (findItemFolderId(treeState.tree, modals.modal.item) ?? null)
            : null
        }
        libraryName={activeLibrary?.name ?? "Library"}
        onOpenChange={(open) => !open && modals.closeModal()}
        onMove={async (folderId) => {
          if (modals.modal.kind !== "move") return;
          await treeState.moveItem(modals.modal.item, folderId);
          modals.closeModal();
        }}
      />

      {activeLibrary && (
        <ShareLibraryModal
          open={modals.shareOpen}
          libraryId={libraryId}
          libraryName={activeLibrary.name}
          onOpenChange={modals.setShareOpen}
        />
      )}
    </div>
  );

  return (
    <LibraryProviders
      scope={scopeValue}
      tree={treeValue}
      actions={actionsValue}
      header={headerValue}
    >
      {isRecallPage ? (
        <RecallChatProvider
          libraryId={libraryId}
          isRecallPage={isRecallPage}
          contextFolderId={contextFolderId}
        >
          {layout}
        </RecallChatProvider>
      ) : (
        layout
      )}
    </LibraryProviders>
  );
}
