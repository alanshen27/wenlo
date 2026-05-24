"use client";

import { createContext, useContext, type ReactNode } from "react";

const PageLinkLibraryContext = createContext<string | null>(null);

export function PageLinkLibraryProvider({
  libraryId,
  children,
}: {
  libraryId: string;
  children: ReactNode;
}) {
  return (
    <PageLinkLibraryContext.Provider value={libraryId}>{children}</PageLinkLibraryContext.Provider>
  );
}

export function usePageLinkLibraryId() {
  return useContext(PageLinkLibraryContext);
}
