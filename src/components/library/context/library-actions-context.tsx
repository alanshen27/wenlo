"use client";

import { createContext, useContext } from "react";
import type { LibraryActionsContextValue } from "@/components/library/context/types";

const LibraryActionsContext = createContext<LibraryActionsContextValue | null>(null);

export function LibraryActionsProvider({
  value,
  children,
}: {
  value: LibraryActionsContextValue;
  children: React.ReactNode;
}) {
  return <LibraryActionsContext.Provider value={value}>{children}</LibraryActionsContext.Provider>;
}

/** Create/move/delete triggers and preview panel controls. Stable callback references. */
export function useLibraryActions(): LibraryActionsContextValue {
  const ctx = useContext(LibraryActionsContext);
  if (!ctx) throw new Error("useLibraryActions must be used within LibraryShell");
  return ctx;
}
