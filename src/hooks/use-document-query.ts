"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  apiGet,
  getApiErrorMessage,
  isCanceledError,
  isNotFoundError,
} from "@/lib/client/api";

type LibraryDocument = { id: string; libraryId: string };

type Options<T extends LibraryDocument> = {
  id: string;
  libraryId: string;
  queryKey: readonly unknown[];
  path: string;
  homeRoute: (libraryId: string) => string;
  itemRoute: (libraryId: string, id: string) => string;
  errorMessage?: string;
};

/**
 * Cached document fetch with library mismatch redirect and 404 → home redirect.
 * Used by page, deck, board, flowchart, and database views.
 */
export function useDocumentQuery<T extends LibraryDocument>({
  id,
  libraryId,
  queryKey,
  path,
  homeRoute,
  itemRoute,
  errorMessage = "Couldn't load this item.",
}: Options<T>) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey,
    queryFn: () => apiGet<T>(path),
    enabled: Boolean(id),
    meta: { errorMessage },
  });

  useEffect(() => {
    const data = query.data;
    if (!data?.libraryId || data.libraryId === libraryId) return;
    router.replace(itemRoute(data.libraryId, data.id));
  }, [query.data, libraryId, router, itemRoute]);

  useEffect(() => {
    if (query.error && isNotFoundError(query.error)) {
      router.replace(homeRoute(libraryId));
    }
  }, [query.error, libraryId, router, homeRoute]);

  const loadError =
    query.error && !isCanceledError(query.error) && !isNotFoundError(query.error)
      ? getApiErrorMessage(query.error, errorMessage)
      : null;

  const setData = (updater: (prev: T | undefined) => T | undefined) => {
    queryClient.setQueryData<T>(queryKey, updater);
  };

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    loadError,
    reload: () => void query.refetch(),
    setData,
  };
}
