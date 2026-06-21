"use client";

import type { ReactNode } from "react";
import { LibraryActionsProvider } from "@/components/library/context/library-actions-context";
import { LibraryHeaderProvider } from "@/components/library/context/library-header-context";
import { LibraryScopeProvider } from "@/components/library/context/library-scope-context";
import { LibraryTreeProvider } from "@/components/library/context/library-tree-context";
import type {
  LibraryActionsContextValue,
  LibraryHeaderContextValue,
  LibraryScopeContextValue,
  LibraryTreeContextValue,
} from "@/components/library/context/types";

type Props = {
  scope: LibraryScopeContextValue;
  tree: LibraryTreeContextValue;
  actions: LibraryActionsContextValue;
  header: LibraryHeaderContextValue;
  children: ReactNode;
};

/** Nests split library contexts so consumers subscribe only to what they need. */
export function LibraryProviders({ scope, tree, actions, header, children }: Props) {
  return (
    <LibraryScopeProvider value={scope}>
      <LibraryTreeProvider value={tree}>
        <LibraryActionsProvider value={actions}>
          <LibraryHeaderProvider value={header}>{children}</LibraryHeaderProvider>
        </LibraryActionsProvider>
      </LibraryTreeProvider>
    </LibraryScopeProvider>
  );
}
