"use client";

import { useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { FlatFolder } from "@/components/library/context/types";
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
import { apiGet, apiPatch, apiPost } from "@/lib/client/api";
import { queryKeys } from "@/lib/client/query-keys";
import { toastError } from "@/lib/client/toast";
import type { BreadcrumbItem, FolderItem, FolderNode, MovableEntry } from "@/lib/library/folders";
import { uploadFile } from "@/lib/documents/upload";
import {
  documentOpenRoute,
  folderHome,
  libraryHome,
  pageRoute,
  recallRoute,
  searchRoute,
} from "@/lib/client/routes";

export type LibraryTreeData = {
  tree: FolderNode[];
  folders: FlatFolder[];
};

const EMPTY_TREE: LibraryTreeData = { tree: [], folders: [] };

/** Server-backed folder tree for a library (TanStack Query). */
export function useLibraryTreeQuery(libraryId: string) {
  return useQuery({
    queryKey: queryKeys.libraryTree(libraryId),
    queryFn: () =>
      apiGet<LibraryTreeData>(`/api/folders?libraryId=${encodeURIComponent(libraryId)}`),
    enabled: Boolean(libraryId),
    placeholderData: (prev) => prev,
  });
}

type TreeMutationOptions = {
  libraryId: string;
};

/**
 * Tree reads from React Query; mutations patch the cache optimistically and
 * invalidate on failure. Used by `LibraryShell` to populate `LibraryTreeContext`.
 */
export function useLibraryTreeMutations({ libraryId }: TreeMutationOptions) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.libraryTree(libraryId);

  const { data, isLoading, isFetching, isFetched, refetch } = useLibraryTreeQuery(libraryId);

  const tree = data?.tree ?? EMPTY_TREE.tree;
  const folders = data?.folders ?? EMPTY_TREE.folders;
  const treeRef = useRef(tree);
  treeRef.current = tree;

  const patchTree = useCallback(
    (updater: (prev: LibraryTreeData) => LibraryTreeData) => {
      queryClient.setQueryData<LibraryTreeData>(queryKey, (prev) =>
        updater(prev ?? EMPTY_TREE)
      );
    },
    [queryClient, queryKey]
  );

  const refreshTree = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const pollDocumentStatus = useCallback(
    (documentId: string) => {
      let attempts = 0;
      const tick = async () => {
        attempts += 1;
        try {
          const { status } = await apiGet<{ status: string }>(
            `/api/documents/${documentId}/status`
          );
          if (status !== "PROCESSING") {
            patchTree((prev) => ({
              ...prev,
              tree: setDocumentStatus(prev.tree, documentId, status),
            }));
            return;
          }
        } catch {
          /* keep polling on transient errors */
        }
        if (attempts < 60) {
          window.setTimeout(tick, 2000);
        } else {
          patchTree((prev) => ({
            ...prev,
            tree: setDocumentProcessing(prev.tree, documentId, false),
          }));
        }
      };
      window.setTimeout(tick, 2000);
    },
    [patchTree]
  );

  const reindexDocument = useCallback(
    async (documentId: string) => {
      patchTree((prev) => ({
        ...prev,
        tree: setDocumentStatus(prev.tree, documentId, "PROCESSING"),
      }));
      try {
        await apiPost(`/api/documents/${documentId}/reindex`, {});
        pollDocumentStatus(documentId);
      } catch (error) {
        patchTree((prev) => ({
          ...prev,
          tree: setDocumentStatus(prev.tree, documentId, "FAILED"),
        }));
        toastError(error, "Couldn't reindex file");
      }
    },
    [patchTree, pollDocumentStatus]
  );

  const uploadToFolder = useCallback(
    async (folderId: string | null, files: FileList | File[]) => {
      const fileList = Array.from(files);
      const pending = createPendingUploads(fileList);

      patchTree((prev) => ({
        ...prev,
        tree: addOptimisticDocuments(prev.tree, pending, folderId),
      }));

      await Promise.all(
        fileList.map(async (file, index) => {
          const tempId = pending[index].id;
          try {
            const uploaded = await uploadFile({ libraryId, folderId, file });
            const processing = uploaded.status === "PROCESSING";
            patchTree((prev) => ({
              ...prev,
              tree: replaceOptimisticDocument(prev.tree, tempId, {
                ...uploaded,
                processing,
                status: uploaded.status,
              }),
            }));
            if (processing) pollDocumentStatus(uploaded.id);
          } catch (error) {
            patchTree((prev) => ({
              ...prev,
              tree: removeOptimisticDocument(prev.tree, tempId),
            }));
            toastError(error, `Couldn't upload ${file.name}`);
          }
        })
      );
    },
    [libraryId, patchTree, pollDocumentStatus]
  );

  const moveItem = useCallback(
    async (item: FolderItem, folderId: string | null) => {
      if (!item.title) return;

      const prevData = queryClient.getQueryData<LibraryTreeData>(queryKey) ?? EMPTY_TREE;
      if (findItemFolderId(prevData.tree, item) === folderId) return;

      const nextTree = moveItemInTree(prevData.tree, item, folderId);
      patchTree((prev) => ({ ...prev, tree: nextTree }));

      const url = item.kind === "page" ? `/api/pages/${item.id}` : `/api/documents/${item.id}`;
      try {
        await apiPatch(url, { folderId });
      } catch (error) {
        patchTree(() => prevData);
        toastError(error, "Couldn't move item");
      }
    },
    [queryClient, queryKey, patchTree]
  );

  const moveFolder = useCallback(
    async (id: string, parentId: string | null) => {
      if (id === parentId) return;
      try {
        await apiPatch(`/api/folders/${id}`, { parentId });
      } catch (error) {
        toastError(error, "Couldn't move folder");
        throw error;
      }
    },
    []
  );

  const moveEntriesToFolder = useCallback(
    async (entries: MovableEntry[], targetFolderId: string | null) => {
      try {
        for (const entry of entries) {
          if (entry.kind === "folder") {
            await moveFolder(entry.id, targetFolderId);
          } else {
            await moveItem(entry, targetFolderId);
          }
        }
        await refreshTree();
      } catch {
        /* individual handlers toast */
      }
    },
    [moveFolder, moveItem, refreshTree]
  );

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
          const found = findItemInTree(treeRef.current, { kind: "document", id: item.id });
          return documentOpenRoute(libraryId, item.id, found?.type);
        }
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

  const treeLoaded = Boolean(libraryId) && isFetched && !isLoading;

  return {
    tree,
    folders,
    treeLoaded,
    treeFetching: isFetching,
    refreshTree,
    uploadToFolder,
    reindexDocument,
    moveItem,
    moveEntriesToFolder,
    breadcrumbHref,
  };
}

export function useInvalidateLibraryTree() {
  const queryClient = useQueryClient();
  return (libraryId: string) =>
    void queryClient.invalidateQueries({ queryKey: queryKeys.libraryTree(libraryId) });
}
