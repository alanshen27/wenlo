"use client";

import { createContext, useContext } from "react";
import type { LibraryTreeContextValue } from "@/components/library/context/types";

const LibraryTreeContext = createContext<LibraryTreeContextValue | null>(null);

export function LibraryTreeProvider({
  value,
  children,
}: {
  value: LibraryTreeContextValue;
  children: React.ReactNode;
}) {
  return <LibraryTreeContext.Provider value={value}>{children}</LibraryTreeContext.Provider>;
}

/** Folder tree, flat folder list, and tree mutation helpers. Re-renders on tree refresh. */
export function useLibraryTree(): LibraryTreeContextValue {
  const ctx = useContext(LibraryTreeContext);
  if (!ctx) throw new Error("useLibraryTree must be used within LibraryShell");
  return ctx;
}
