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
import { ConfirmModal } from "@/components/modals/confirm-modal";
import { MainHeader } from "@/components/library/main-header";
import { buildRouteBreadcrumbs } from "@/lib/route-breadcrumbs";
import type { BreadcrumbItem, FolderNode } from "@/lib/folders";
import type { FolderColorId } from "@/lib/folder-colors";
import type { SidebarDragItem } from "@/lib/sidebar-dnd";
import {
  addOptimisticDocuments,
  createPendingUploads,
  findItemFolderId,
  findItemInTree,
  moveItemInTree,
  removeOptimisticDocument,
  replaceOptimisticDocument,
} from "@/lib/tree-mutations";
import { uploadFile } from "@/lib/upload";
import {
  documentRoute,
  folderHome,
  libraryHome,
  pageRoute,
  persistActiveLibrary,
  recallRoute,
  searchRoute,
} from "@/lib/routes";

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
  | { kind: "document-delete"; id: string; title: string };

type HeaderState = {
  saving?: boolean;
  titleOverride?: string;
  folderIdFallback?: string | null;
};

type LibraryContextValue = {
  libraryId: string;
  libraries: Library[];
  activeLibrary: Library | undefined;
  tree: FolderNode[];
  folders: FlatFolder[];
  contextFolderId: string | null;
  refreshTree: () => Promise<void>;
  breadcrumbHref: (item: BreadcrumbItem) => string | null;
  setHeader: (state: HeaderState) => void;
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
  }>();

  const libraryId = params.libraryId;
  const selectedFolderId = params.folderId ?? null;
  const selectedPageId = params.pageId ?? null;
  const selectedDocumentId = params.documentId ?? null;

  const [libraries, setLibraries] = useState<Library[]>([]);
  const [tree, setTree] = useState<FolderNode[]>([]);
  const [folders, setFolders] = useState<FlatFolder[]>([]);
  const [contextFolderId, setContextFolderId] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>({ kind: "none" });
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [header, setHeader] = useState<HeaderState>({});

  const activeLibrary = libraries.find((l) => l.id === libraryId);
  const isSearchPage = pathname.endsWith("/search");
  const isRecallPage = pathname.endsWith("/recall");
  const activeNav = isSearchPage ? "search" : isRecallPage ? "recall" : null;

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
    const res = await fetch(`/api/folders?libraryId=${libraryId}`);
    if (!res.ok) return;
    const data = await res.json();
    setTree(data.tree);
    setFolders(data.folders);
  }, [libraryId]);

  const loadLibraries = useCallback(async () => {
    const res = await fetch("/api/libraries");
    if (!res.ok) return;
    const data = (await res.json()) as Library[];
    setLibraries(data);
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
  }, [libraryId, selectedFolderId, selectedPageId, selectedDocumentId, isSearchPage, isRecallPage]);

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
        case "document":
          return documentRoute(libraryId, item.id);
        case "search":
          return searchRoute(libraryId);
        case "recall":
          return recallRoute(libraryId);
        default:
          return null;
      }
    },
    [libraryId]
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
      const res = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId, libraryId, title: "Untitled" }),
      });
      const data = await res.json();
      await refreshTree();
      router.push(pageRoute(libraryId, data.id));
    },
    [libraryId, refreshTree, router]
  );

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
        const res = await fetch(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folderId }),
        });
        if (!res.ok) throw new Error("Move failed");
      } catch {
        setTree(previousTree);
      }
    },
    []
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
            setTree((prev) => replaceOptimisticDocument(prev, tempId, uploaded));
          } catch {
            setTree((prev) => removeOptimisticDocument(prev, tempId));
          }
        })
      );
    },
    [libraryId]
  );

  async function handleFolderSubmit(data: { name: string; color: FolderColorId }) {
    if (modal.kind === "folder-create") {
      await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          color: data.color,
          parentId: modal.parentId,
          libraryId,
        }),
      });
    } else if (modal.kind === "folder-edit") {
      await fetch(`/api/folders/${modal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.name, color: data.color }),
      });
    }
    refreshTree();
  }

  async function handleLibrarySubmit(data: { name: string; icon: string }) {
    if (modal.kind === "library-create") {
      const res = await fetch("/api/libraries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) return;
      const library = (await res.json()) as Library;
      setLibraries((prev) => [...prev, library]);
      persistActiveLibrary(library.id);
      router.push(libraryHome(library.id));
    } else if (modal.kind === "library-edit") {
      const res = await fetch(`/api/libraries/${modal.library.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) return;
      const updated = (await res.json()) as Library;
      setLibraries((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    }
  }

  async function handleConfirmDelete() {
    setDeleteLoading(true);
    try {
      if (modal.kind === "folder-delete") {
        await fetch(`/api/folders/${modal.id}`, { method: "DELETE" });
        if (selectedFolderId === modal.id) router.push(libraryHome(libraryId));
        refreshTree();
      } else if (modal.kind === "page-delete") {
        await fetch(`/api/pages/${modal.id}`, { method: "DELETE" });
        if (selectedPageId === modal.id) router.push(libraryHome(libraryId));
        refreshTree();
      } else if (modal.kind === "document-delete") {
        await fetch(`/api/documents/${modal.id}`, { method: "DELETE" });
        if (selectedDocumentId === modal.id) router.push(libraryHome(libraryId));
        refreshTree();
      } else if (modal.kind === "library-delete") {
        const res = await fetch(`/api/libraries/${modal.library.id}`, { method: "DELETE" });
        if (!res.ok) return;
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
      tree,
      folders,
      contextFolderId,
      refreshTree,
      breadcrumbHref,
      setHeader: setHeaderState,
    }),
    [
      libraryId,
      libraries,
      activeLibrary,
      tree,
      folders,
      contextFolderId,
      refreshTree,
      breadcrumbHref,
      setHeaderState,
    ]
  );

  return (
    <LibraryContext.Provider value={contextValue}>
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        <FolderSidebar
          libraries={libraries}
          activeLibraryId={libraryId}
          onSelectLibrary={selectLibrary}
          onCreateLibrary={() => setModal({ kind: "library-create" })}
          onEditLibrary={(library) => setModal({ kind: "library-edit", library })}
          onDeleteLibrary={(library) => setModal({ kind: "library-delete", library })}
          tree={tree}
          selectedFolderId={selectedFolderId}
          selectedPageId={selectedPageId}
          selectedDocumentId={selectedDocumentId}
          activeNav={activeNav}
          onSelectFolder={(id) => {
            if (id) router.push(folderHome(libraryId, id));
            else router.push(libraryHome(libraryId));
          }}
          onSelectPage={(id) => router.push(pageRoute(libraryId, id))}
          onSelectDocument={(id) => router.push(documentRoute(libraryId, id))}
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
          onOpenSearch={() => router.push(searchRoute(libraryId))}
          onOpenRecall={() => router.push(recallRoute(libraryId))}
        />

        <main className="flex flex-1 flex-col overflow-hidden">
          <MainHeader breadcrumbs={breadcrumbs} hrefFor={breadcrumbHref} saving={header.saving} />
          {children}
        </main>

        <FolderModal
          open={modal.kind === "folder-create" || modal.kind === "folder-edit"}
          mode={modal.kind === "folder-edit" ? "edit" : "create"}
          initialName={modal.kind === "folder-edit" ? modal.name : ""}
          initialColor={modal.kind === "folder-edit" ? modal.color : "gray"}
          onOpenChange={(open) => !open && setModal({ kind: "none" })}
          onSubmit={handleFolderSubmit}
        />

        <LibraryModal
          open={modal.kind === "library-create" || modal.kind === "library-edit"}
          mode={modal.kind === "library-edit" ? "edit" : "create"}
          initialName={modal.kind === "library-edit" ? modal.library.name : ""}
          initialIcon={modal.kind === "library-edit" ? modal.library.icon : "📚"}
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
      </div>
    </LibraryContext.Provider>
  );
}
