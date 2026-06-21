"use client";

import { createContext, useContext } from "react";
import type { LibraryHeaderContextValue } from "@/components/library/context/types";

const LibraryHeaderContext = createContext<LibraryHeaderContextValue | null>(null);

export function LibraryHeaderProvider({
  value,
  children,
}: {
  value: LibraryHeaderContextValue;
  children: React.ReactNode;
}) {
  return <LibraryHeaderContext.Provider value={value}>{children}</LibraryHeaderContext.Provider>;
}

/** Push document header state (title, save status) into the library shell. */
export function useLibraryHeader(): LibraryHeaderContextValue {
  const ctx = useContext(LibraryHeaderContext);
  if (!ctx) throw new Error("useLibraryHeader must be used within LibraryShell");
  return ctx;
}
