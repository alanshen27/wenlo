"use client";

import { createContext, useContext } from "react";
import type { LibraryScopeContextValue } from "@/components/library/context/types";

const LibraryScopeContext = createContext<LibraryScopeContextValue | null>(null);

export function LibraryScopeProvider({
  value,
  children,
}: {
  value: LibraryScopeContextValue;
  children: React.ReactNode;
}) {
  return <LibraryScopeContext.Provider value={value}>{children}</LibraryScopeContext.Provider>;
}

/** Current library, role, and route-derived folder context. Re-renders on library switch. */
export function useLibraryScope(): LibraryScopeContextValue {
  const ctx = useContext(LibraryScopeContext);
  if (!ctx) throw new Error("useLibraryScope must be used within LibraryShell");
  return ctx;
}

/** Optional scope for components that render in both library and standalone modes. */
export function useLibraryScopeOptional(): LibraryScopeContextValue | null {
  return useContext(LibraryScopeContext);
}
