"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Library } from "@/components/sidebar/library-switcher";
import { apiGet } from "@/lib/client/api";
import { queryKeys } from "@/lib/client/query-keys";

/** Cached list of libraries the signed-in user can access. */
export function useLibraries() {
  return useQuery({
    queryKey: queryKeys.libraries,
    queryFn: () => apiGet<Library[]>("/api/libraries"),
    meta: { errorMessage: "Couldn't load libraries" },
  });
}

export function useInvalidateLibraries() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: queryKeys.libraries });
}

/** Append or replace a library in the cached libraries list. */
export function useUpsertLibrary() {
  const queryClient = useQueryClient();
  return (library: Library) => {
    queryClient.setQueryData<Library[]>(queryKeys.libraries, (prev) => {
      if (!prev) return [library];
      const idx = prev.findIndex((l) => l.id === library.id);
      if (idx === -1) return [...prev, library];
      const next = [...prev];
      next[idx] = library;
      return next;
    });
  };
}

/** Remove a library from the cached list after deletion. */
export function useRemoveLibrary() {
  const queryClient = useQueryClient();
  return (libraryId: string) => {
    queryClient.setQueryData<Library[]>(queryKeys.libraries, (prev) =>
      prev ? prev.filter((l) => l.id !== libraryId) : prev
    );
  };
}
