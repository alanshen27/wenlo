/**
 * Split library React contexts and hooks.
 *
 * Prefer narrow hooks so components re-render only when their slice changes:
 * - `useLibraryScope()` — library id, role, permissions
 * - `useLibraryTree()` — folder tree and tree mutations
 * - `useLibraryActions()` — create items, modals, preview panel
 * - `useLibraryHeader()` — document title/save status for the shell header
 */
export type {
  FlatFolder,
  HeaderState,
  LibraryActionsContextValue,
  LibraryHeaderContextValue,
  LibraryModal,
  LibraryScopeContextValue,
  LibraryTreeContextValue,
} from "@/components/library/context/types";

export {
  LibraryScopeProvider,
  useLibraryScope,
  useLibraryScopeOptional,
} from "@/components/library/context/library-scope-context";

export { LibraryTreeProvider, useLibraryTree } from "@/components/library/context/library-tree-context";

export {
  LibraryActionsProvider,
  useLibraryActions,
} from "@/components/library/context/library-actions-context";

export {
  LibraryHeaderProvider,
  useLibraryHeader,
} from "@/components/library/context/library-header-context";

export { LibraryProviders } from "@/components/library/context/library-providers";
