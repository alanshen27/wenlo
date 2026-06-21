import type { PreviewTarget } from "@/components/cloud/file-preview-panel";
import type { SaveStatus } from "@/components/native/save-status-indicator";
import type { Library } from "@/components/sidebar/library-switcher";
import type { FolderColorId } from "@/lib/library/folder-colors";
import type { BreadcrumbItem, FolderItem, FolderNode, MovableEntry } from "@/lib/library/folders";
import type { PageCollaborator } from "@/lib/realtime/page-presence";

/** Flat folder row returned by `/api/folders` for move modals and breadcrumbs. */
export type FlatFolder = { id: string; name: string; color: string; parentId: string | null };

/** Document views push title, save status, and collaborators into the shell header. */
export type HeaderState = {
  saveStatus?: SaveStatus;
  titleOverride?: string;
  folderIdFallback?: string | null;
  collaborators?: PageCollaborator[];
  remoteNotice?: string | null;
};

/** Active library identity, membership, and sidebar selection context. */
export type LibraryScopeContextValue = {
  libraryId: string;
  libraries: Library[];
  activeLibrary: Library | undefined;
  libraryRole: Library["role"];
  canEdit: boolean;
  /** Folder inferred from the current route (page/doc/folder selection). */
  contextFolderId: string | null;
};

/** Folder tree data and mutations that touch tree state. */
export type LibraryTreeContextValue = {
  tree: FolderNode[];
  treeLoaded: boolean;
  folders: FlatFolder[];
  refreshTree: () => Promise<void>;
  uploadToFolder: (folderId: string | null, files: FileList | File[]) => Promise<void>;
  reindexDocument: (documentId: string) => Promise<void>;
  breadcrumbHref: (item: BreadcrumbItem) => string | null;
  moveItem: (item: FolderItem, folderId: string | null) => Promise<void>;
  moveEntriesToFolder: (entries: MovableEntry[], folderId: string | null) => Promise<void>;
};

/** Imperative library actions (create items, open modals, preview panel). */
export type LibraryActionsContextValue = {
  createPage: (folderId: string | null) => Promise<void>;
  createBoard: (folderId: string | null) => Promise<void>;
  createDeck: (folderId: string | null) => Promise<void>;
  createDatabase: (folderId: string | null) => Promise<void>;
  createFlowchart: (folderId: string | null) => Promise<void>;
  beginCreateFolder: (parentId: string | null) => void;
  beginEditFolder: (folder: { id: string; name: string; color: FolderColorId }) => void;
  beginDeleteFolder: (folder: { id: string; name: string }) => void;
  beginDeletePage: (page: { id: string; title: string }) => void;
  beginDeleteDocument: (doc: { id: string; title: string }) => void;
  beginMove: (item: FolderItem) => void;
  openDocumentPreview: (target: PreviewTarget) => void;
  closeDocumentPreview: () => void;
  openLibraryCreate: () => void;
  openLibraryEdit: (library: Library) => void;
  openLibraryDelete: (library: Library) => void;
  openShareLibrary: () => void;
};

/** Lets nested document views update the shell header without prop drilling. */
export type LibraryHeaderContextValue = {
  setHeader: (state: HeaderState) => void;
};

/** Discriminated union for shell-owned modal dialogs. */
export type LibraryModal =
  | { kind: "none" }
  | { kind: "folder-create"; parentId: string | null }
  | { kind: "folder-edit"; id: string; name: string; color: FolderColorId }
  | { kind: "folder-delete"; id: string; name: string }
  | { kind: "library-create" }
  | { kind: "library-edit"; library: Library }
  | { kind: "library-delete"; library: Library }
  | { kind: "page-delete"; id: string; title: string }
  | { kind: "document-delete"; id: string; title: string }
  | { kind: "move"; item: FolderItem };
