"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { LibraryModal } from "@/components/library/context/types";
import type { PreviewTarget } from "@/components/cloud/file-preview-panel";
import type { Library } from "@/components/sidebar/library-switcher";
import type { FolderColorId } from "@/lib/library/folder-colors";
import type { FolderItem } from "@/lib/library/folders";
import { apiDelete, apiPatch, apiPost } from "@/lib/client/api";
import { toastError, toastSuccess } from "@/lib/client/toast";
import {
  useRemoveLibrary,
  useUpsertLibrary,
} from "@/hooks/use-libraries";
import {
  boardRoute,
  databaseRoute,
  deckRoute,
  flowchartRoute,
  libraryHome,
  pageRoute,
  persistActiveLibrary,
} from "@/lib/client/routes";

type Options = {
  libraryId: string;
  libraries: Library[];
  refreshTree: () => Promise<void>;
  selectedFolderId: string | null;
  selectedPageId: string | null;
  selectedDocumentId: string | null;
  onPreviewCloseForDocument: (documentId: string) => void;
};

/**
 * Shell modal state plus create/delete flows that navigate after mutations.
 * Modal confirm handlers live here; `LibraryShell` renders the dialog components.
 */
export function useLibraryModals({
  libraryId,
  libraries,
  refreshTree,
  selectedFolderId,
  selectedPageId,
  selectedDocumentId,
  onPreviewCloseForDocument,
}: Options) {
  const router = useRouter();
  const upsertLibrary = useUpsertLibrary();
  const removeLibrary = useRemoveLibrary();
  const [modal, setModal] = useState<LibraryModal>({ kind: "none" });
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  const beginDeleteDocument = useCallback(
    (doc: { id: string; title: string }) =>
      setModal({ kind: "document-delete", id: doc.id, title: doc.title }),
    []
  );

  const beginMove = useCallback((item: FolderItem) => setModal({ kind: "move", item }), []);

  const openShareLibrary = useCallback(() => setShareOpen(true), []);

  const openLibraryCreate = useCallback(() => setModal({ kind: "library-create" }), []);
  const openLibraryEdit = useCallback(
    (library: Library) => setModal({ kind: "library-edit", library }),
    []
  );
  const openLibraryDelete = useCallback(
    (library: Library) => setModal({ kind: "library-delete", library }),
    []
  );

  const closeModal = useCallback(() => setModal({ kind: "none" }), []);

  async function handleFolderSubmit(data: { name: string; color: FolderColorId }) {
    try {
      if (modal.kind === "folder-create") {
        await apiPost("/api/folders", {
          name: data.name,
          color: data.color,
          parentId: modal.parentId,
          libraryId,
        });
        toastSuccess("Folder created");
      } else if (modal.kind === "folder-edit") {
        await apiPatch(`/api/folders/${modal.id}`, { name: data.name, color: data.color });
        toastSuccess("Folder updated");
      }
      await refreshTree();
    } catch (error) {
      toastError(error, "Couldn't save folder");
    }
  }

  async function handleLibrarySubmit(data: { name: string; icon: string }) {
    try {
      if (modal.kind === "library-create") {
        const library = await apiPost<Library>("/api/libraries", data);
        upsertLibrary(library);
        persistActiveLibrary(library.id);
        router.push(libraryHome(library.id));
        toastSuccess("Library created");
      } else if (modal.kind === "library-edit") {
        const updated = await apiPatch<Library>(`/api/libraries/${modal.library.id}`, data);
        upsertLibrary(updated);
        toastSuccess("Library updated");
      }
    } catch (error) {
      toastError(error, "Couldn't save library");
    }
  }

  async function handleConfirmDelete() {
    setDeleteLoading(true);
    try {
      if (modal.kind === "folder-delete") {
        await apiDelete(`/api/folders/${modal.id}`);
        if (selectedFolderId === modal.id) router.push(libraryHome(libraryId));
        await refreshTree();
        toastSuccess("Folder deleted");
      } else if (modal.kind === "page-delete") {
        await apiDelete(`/api/pages/${modal.id}`);
        if (selectedPageId === modal.id) router.push(libraryHome(libraryId));
        await refreshTree();
        toastSuccess("Page deleted");
      } else if (modal.kind === "document-delete") {
        await apiDelete(`/api/documents/${modal.id}`);
        if (selectedDocumentId === modal.id) router.push(libraryHome(libraryId));
        onPreviewCloseForDocument(modal.id);
        await refreshTree();
        toastSuccess("File deleted");
      } else if (modal.kind === "library-delete") {
        await apiDelete(`/api/libraries/${modal.library.id}`);
        removeLibrary(modal.library.id);
        const remaining = libraries.filter((l) => l.id !== modal.library.id);
        const nextId = remaining[0]?.id ?? null;
        if (nextId) {
          persistActiveLibrary(nextId);
          router.push(libraryHome(nextId));
        } else {
          router.push("/");
        }
        toastSuccess("Library deleted");
      }
      setModal({ kind: "none" });
    } catch (error) {
      toastError(error, "Couldn't delete");
    } finally {
      setDeleteLoading(false);
    }
  }

  return {
    modal,
    shareOpen,
    deleteLoading,
    setShareOpen,
    closeModal,
    beginCreateFolder,
    beginEditFolder,
    beginDeleteFolder,
    beginDeletePage,
    beginDeleteDocument,
    beginMove,
    openShareLibrary,
    openLibraryCreate,
    openLibraryEdit,
    openLibraryDelete,
    handleFolderSubmit,
    handleLibrarySubmit,
    handleConfirmDelete,
  };
}

/** Stable create-item callbacks shared by sidebar and cloud views. */
export function useLibraryCreateActions(
  libraryId: string,
  refreshTree: () => Promise<void>
) {
  const router = useRouter();

  const createPage = useCallback(
    async (folderId: string | null) => {
      try {
        const data = await apiPost<{ id: string }>("/api/pages", {
          folderId,
          libraryId,
          title: "Untitled",
        });
        await refreshTree();
        router.push(pageRoute(libraryId, data.id));
      } catch (error) {
        toastError(error, "Couldn't create page");
      }
    },
    [libraryId, refreshTree, router]
  );

  const createBoard = useCallback(
    async (folderId: string | null) => {
      try {
        const data = await apiPost<{ id: string }>("/api/documents", {
          type: "WHITEBOARD",
          folderId,
          libraryId,
          title: "Untitled whiteboard",
        });
        await refreshTree();
        router.push(boardRoute(libraryId, data.id));
      } catch (error) {
        toastError(error, "Couldn't create whiteboard");
      }
    },
    [libraryId, refreshTree, router]
  );

  const createDeck = useCallback(
    async (folderId: string | null) => {
      try {
        const data = await apiPost<{ id: string }>("/api/documents", {
          type: "DECK",
          folderId,
          libraryId,
          title: "Untitled deck",
        });
        await refreshTree();
        router.push(deckRoute(libraryId, data.id));
      } catch (error) {
        toastError(error, "Couldn't create deck");
      }
    },
    [libraryId, refreshTree, router]
  );

  const createDatabase = useCallback(
    async (folderId: string | null) => {
      try {
        const data = await apiPost<{ id: string }>("/api/documents", {
          type: "DATABASE",
          folderId,
          libraryId,
          title: "Untitled database",
        });
        await refreshTree();
        router.push(databaseRoute(libraryId, data.id));
      } catch (error) {
        toastError(error, "Couldn't create database");
      }
    },
    [libraryId, refreshTree, router]
  );

  const createFlowchart = useCallback(
    async (folderId: string | null) => {
      try {
        const data = await apiPost<{ id: string }>("/api/documents", {
          type: "FLOWCHART",
          folderId,
          libraryId,
          title: "Untitled flowchart",
        });
        await refreshTree();
        router.push(flowchartRoute(libraryId, data.id));
      } catch (error) {
        toastError(error, "Couldn't create flowchart");
      }
    },
    [libraryId, refreshTree, router]
  );

  return {
    createPage,
    createBoard,
    createDeck,
    createDatabase,
    createFlowchart,
  };
}

/** Preview panel open/close state owned by the shell layout. */
export function useLibraryPreview() {
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget | null>(null);

  const openDocumentPreview = useCallback(
    (target: PreviewTarget) => setPreviewTarget(target),
    []
  );

  const closeDocumentPreview = useCallback(() => setPreviewTarget(null), []);

  const closePreviewIfDocument = useCallback((documentId: string) => {
    setPreviewTarget((prev) => (prev?.id === documentId ? null : prev));
  }, []);

  return {
    previewTarget,
    openDocumentPreview,
    closeDocumentPreview,
    closePreviewIfDocument,
  };
}
