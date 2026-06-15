"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  ChevronDown,
  CloudUpload,
  FilePlus,
  FileText,
  FolderClosed,
  FolderInput,
  Loader2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useLibrary } from "@/components/library/library-shell";
import { CloudToolbar, type SortMode, type ViewMode } from "@/components/cloud/cloud-toolbar";
import { EntityCard, EntityTable, type CloudItem } from "@/components/cloud/entities";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ViewContainer, ViewHeader, ViewScroll, SectionLabel } from "@/components/ui/view";
import { ConfirmModal } from "@/components/modals/confirm-modal";
import { MoveModal } from "@/components/modals/move-modal";
import { getFolderContents } from "@/lib/library/folders";
import { FileArtwork, FolderArtwork } from "@/lib/client/file-icons";
import { LibraryIcon } from "@/components/icons/library-icon";
import type { FolderColorId } from "@/lib/library/folder-colors";
import { apiDelete } from "@/lib/client/api";
import { documentOpenRoute, folderHome, pageRoute } from "@/lib/client/routes";
import {
  parseFolderDropId,
  parseItemDragId,
  type SidebarDragItem,
} from "@/lib/client/sidebar-dnd";
import { formatBytes } from "@/lib/core/utils";

type Props = {
  folderId?: string | null;
};

const VIEW_KEY = "recall:cloud-view";
const SORT_KEY = "recall:cloud-sort";

function usePersistentState<T extends string>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);

  useEffect(() => {
    const stored = window.localStorage.getItem(key);
    if (stored) setValue(stored as T);
  }, [key]);

  const update = useCallback(
    (next: T) => {
      setValue(next);
      window.localStorage.setItem(key, next);
    },
    [key]
  );

  return [value, update] as const;
}

function sortItems(items: CloudItem[], sort: SortMode): CloudItem[] {
  const byName = (a: CloudItem, b: CloudItem) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true });

  if (sort === "name-asc") return [...items].sort(byName);
  if (sort === "name-desc") return [...items].sort((a, b) => byName(b, a));

  const typeKey = (item: CloudItem) =>
    item.kind === "page" ? "page" : item.kind === "document" ? item.type : "";
  return [...items].sort((a, b) => typeKey(a).localeCompare(typeKey(b)) || byName(a, b));
}

export function CloudView({ folderId: folderIdProp }: Props) {
  const params = useParams<{ folderId?: string }>();
  const folderId = folderIdProp !== undefined ? folderIdProp : (params.folderId ?? null);

  const {
    libraryId,
    activeLibrary,
    folders,
    tree,
    treeLoaded,
    canEdit,
    refreshTree,
    uploadToFolder,
    reindexDocument,
    createPage,
    createBoard,
    createDeck,
    createDatabase,
    createFlowchart,
    moveItem,
    beginCreateFolder,
    beginEditFolder,
    beginDeleteFolder,
    beginDeletePage,
    beginDeleteDocument,
    beginMove,
    openDocumentPreview,
  } = useLibrary();

  const [view, setView] = usePersistentState<ViewMode>(VIEW_KEY, "grid");
  const [sort, setSort] = usePersistentState<SortMode>(SORT_KEY, "name-asc");
  const [dragging, setDragging] = useState(false);
  const [activeDrag, setActiveDrag] = useState<SidebarDragItem | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const lastClickedKey = useRef<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const parsed = parseItemDragId(event.active.id);
    if (!parsed) return;
    const data = event.active.data.current as SidebarDragItem | undefined;
    setActiveDrag({ ...parsed, title: data?.title, docType: data?.docType });
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveDrag(null);
      const parsed = parseItemDragId(event.active.id);
      if (!parsed || !event.over) return;
      const data = event.active.data.current as SidebarDragItem | undefined;
      const item: SidebarDragItem = { ...parsed, title: data?.title, docType: data?.docType };
      if (!item.title) return;
      const target = parseFolderDropId(event.over.id);
      if (target === undefined) return;
      await moveItem(item, target);
    },
    [moveItem]
  );

  const selectedFolder = folderId ? folders.find((f) => f.id === folderId) : null;
  const contents = getFolderContents(tree, folderId);

  const folderItems = useMemo<CloudItem[]>(
    () =>
      sortItems(
        contents.folders.map((f) => ({
          kind: "folder" as const,
          id: f.id,
          title: f.name,
          color: f.color,
          count: f.children.length + f.pages.length + f.documents.length,
        })),
        sort
      ),
    [contents.folders, sort]
  );

  const fileItems = useMemo<CloudItem[]>(
    () =>
      sortItems(
        [
          ...contents.pages.map((p) => ({ kind: "page" as const, id: p.id, title: p.title })),
          ...contents.documents.map((d) => ({
            kind: "document" as const,
            id: d.id,
            title: d.title,
            type: d.type,
            sizeBytes: d.sizeBytes,
            pending: d.pending,
            processing: d.processing,
            status: d.status,
          })),
        ],
        sort
      ),
    [contents.pages, contents.documents, sort]
  );

  const isEmpty = folderItems.length === 0 && fileItems.length === 0;

  const keyOf = useCallback((item: CloudItem) => `${item.kind}-${item.id}`, []);
  const isSelectable = useCallback(
    (item: CloudItem) => !(item.kind === "document" && item.pending),
    []
  );

  const orderedSelectable = useMemo(
    () => [...folderItems, ...fileItems].filter(isSelectable),
    [folderItems, fileItems, isSelectable]
  );
  const selectableKeys = useMemo(
    () => orderedSelectable.map(keyOf),
    [orderedSelectable, keyOf]
  );
  const selectedItems = useMemo(
    () => orderedSelectable.filter((item) => selectedKeys.has(keyOf(item))),
    [orderedSelectable, selectedKeys, keyOf]
  );
  const selectionActive = selectedItems.length > 0;
  const allSelected =
    selectableKeys.length > 0 && selectableKeys.every((k) => selectedKeys.has(k));

  // Reset selection when navigating to a different folder (adjust-state-on-prop-
  // change pattern: cheaper and lint-clean vs. an effect).
  const prevFolderRef = useRef(folderId);
  if (prevFolderRef.current !== folderId) {
    prevFolderRef.current = folderId;
    if (selectedKeys.size > 0) setSelectedKeys(new Set());
  }

  const toggleSelect = useCallback(
    (item: CloudItem, shiftKey: boolean) => {
      const key = keyOf(item);
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        if (shiftKey && lastClickedKey.current) {
          const a = selectableKeys.indexOf(lastClickedKey.current);
          const b = selectableKeys.indexOf(key);
          if (a !== -1 && b !== -1) {
            const [lo, hi] = a < b ? [a, b] : [b, a];
            for (let i = lo; i <= hi; i++) next.add(selectableKeys[i]);
            return next;
          }
        }
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
      lastClickedKey.current = key;
    },
    [keyOf, selectableKeys]
  );

  const toggleAll = useCallback(() => {
    setSelectedKeys((prev) =>
      prev.size >= selectableKeys.length ? new Set() : new Set(selectableKeys)
    );
  }, [selectableKeys]);

  const clearSelection = useCallback(() => {
    setSelectedKeys(new Set());
    lastClickedKey.current = null;
  }, []);

  const selectableCount = selectedItems.filter(
    (i) => i.kind === "page" || i.kind === "document"
  ).length;

  const handleBulkDelete = useCallback(async () => {
    setBulkBusy(true);
    try {
      await Promise.all(
        selectedItems.map((item) => {
          const url =
            item.kind === "folder"
              ? `/api/folders/${item.id}`
              : item.kind === "page"
                ? `/api/pages/${item.id}`
                : `/api/documents/${item.id}`;
          return apiDelete(url).catch(() => {});
        })
      );
      await refreshTree();
      clearSelection();
      setBulkDeleteOpen(false);
    } finally {
      setBulkBusy(false);
    }
  }, [selectedItems, refreshTree, clearSelection]);

  const handleBulkMove = useCallback(
    async (targetFolderId: string | null) => {
      const movable = selectedItems.filter(
        (i) => i.kind === "page" || i.kind === "document"
      );
      await Promise.all(
        movable.map((item) =>
          moveItem(
            item.kind === "page"
              ? { type: "page", id: item.id, title: item.title }
              : { type: "document", id: item.id, title: item.title, docType: item.type },
            targetFolderId
          )
        )
      );
      clearSelection();
      setBulkMoveOpen(false);
    },
    [selectedItems, moveItem, clearSelection]
  );

  const tableSelection = canEdit
    ? {
        active: selectionActive,
        isSelectable,
        isSelected: (item: CloudItem) => selectedKeys.has(keyOf(item)),
        onToggle: toggleSelect,
        allSelected,
        onToggleAll: toggleAll,
      }
    : undefined;

  const cardSelection = useCallback(
    (item: CloudItem) =>
      canEdit
        ? {
            selectable: isSelectable(item),
            selected: selectedKeys.has(keyOf(item)),
            active: selectionActive,
            onToggle: (shiftKey: boolean) => toggleSelect(item, shiftKey),
          }
        : undefined,
    [canEdit, isSelectable, selectedKeys, keyOf, selectionActive, toggleSelect]
  );

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      if (!canEdit) return;
      void uploadToFolder(folderId, files);
    },
    [canEdit, folderId, uploadToFolder]
  );

  function hrefFor(item: CloudItem) {
    if (item.kind === "folder") return folderHome(libraryId, item.id);
    if (item.kind === "page") return pageRoute(libraryId, item.id);
    return documentOpenRoute(libraryId, item.id, item.type);
  }

  function actionsFor(item: CloudItem) {
    // Files open in the preview sidebar on single click (double click opens the
    // full page). Previewing is a read action, so viewers get it too.
    const onOpen =
      item.kind === "document" && !item.pending
        ? () => openDocumentPreview({ id: item.id, title: item.title, type: item.type })
        : undefined;

    if (!canEdit) return { onOpen };
    if (item.kind === "folder") {
      return {
        onEdit: () =>
          beginEditFolder({ id: item.id, name: item.title, color: item.color as FolderColorId }),
        onDelete: () => beginDeleteFolder({ id: item.id, name: item.title }),
      };
    }
    if (item.kind === "page") {
      return {
        onMove: () => beginMove({ type: "page", id: item.id, title: item.title }),
        onDelete: () => beginDeletePage({ id: item.id, title: item.title }),
      };
    }
    return {
      onOpen,
      onMove: () =>
        beginMove({ type: "document", id: item.id, title: item.title, docType: item.type }),
      onReindex: () => reindexDocument(item.id),
      onDelete: () => beginDeleteDocument({ id: item.id, title: item.title }),
    };
  }

  function renderGrid(items: CloudItem[], variant: "folder" | "file") {
    const cols =
      variant === "folder"
        ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
        : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";
    return (
      <div className={`grid gap-3 ${cols}`}>
        {items.map((item) => (
          <EntityCard
            key={`${item.kind}-${item.id}`}
            item={item}
            href={hrefFor(item)}
            enableDnd={canEdit}
            selection={cardSelection(item)}
            {...actionsFor(item)}
          />
        ))}
      </div>
    );
  }

  const headerIcon = selectedFolder ? (
    <FolderArtwork color={selectedFolder.color} className="size-8" />
  ) : (
    <LibraryIcon icon={activeLibrary?.icon} className="size-8" />
  );

  const title = selectedFolder ? selectedFolder.name : (activeLibrary?.name ?? "Home");

  const plural = (count: number, label: string) =>
    `${count} ${label}${count === 1 ? "" : "s"}`;
  const totalBytes = contents.documents.reduce(
    (sum, d) => sum + (d.sizeBytes ?? 0),
    0
  );
  const totalSize = formatBytes(totalBytes);

  const stats: string[] = [];
  if (contents.folders.length) stats.push(plural(contents.folders.length, "folder"));
  if (contents.pages.length) stats.push(plural(contents.pages.length, "page"));
  const fileCount = contents.documents.filter((d) => !d.pending).length;
  if (fileCount) stats.push(plural(fileCount, "file"));
  if (totalBytes > 0 && totalSize) stats.push(totalSize);

  return (
    <ViewScroll
      className="relative"
      onDragEnter={(e) => {
        if (!canEdit || !Array.from(e.dataTransfer.types).includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragOver={(e) => {
        if (!canEdit || !Array.from(e.dataTransfer.types).includes("Files")) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveDrag(null)}
      >
      <ViewContainer size="wide" className="space-y-8">
        <ViewHeader
          icon={headerIcon}
          title={title}
          description={
            !treeLoaded ? (
              <Skeleton className="h-4 w-28" />
            ) : (
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {stats.length > 0 ? (
                stats.map((s, i) => (
                  <span key={s}>
                    {i > 0 && <span className="mr-2 text-border">·</span>}
                    {s}
                  </span>
                ))
              ) : (
                <span>Nothing here yet</span>
              )}
            </span>
            )
          }
          actions={
            <CloudToolbar
              canEdit={canEdit}
              view={view}
              onViewChange={setView}
              sort={sort}
              onSortChange={setSort}
              onNewPage={() => createPage(folderId)}
              onNewBoard={() => createBoard(folderId)}
              onNewDeck={() => createDeck(folderId)}
              onNewDatabase={() => createDatabase(folderId)}
              onNewFlowchart={() => createFlowchart(folderId)}
              onNewFolder={() => beginCreateFolder(folderId)}
              onUpload={() => inputRef.current?.click()}
            />
          }
        />

        {canEdit && treeLoaded && (
          <QuickActions
            onNewPage={() => createPage(folderId)}
            onNewBoard={() => createBoard(folderId)}
            onNewDeck={() => createDeck(folderId)}
            onNewDatabase={() => createDatabase(folderId)}
            onNewFlowchart={() => createFlowchart(folderId)}
            onNewFolder={() => beginCreateFolder(folderId)}
            onUpload={() => inputRef.current?.click()}
          />
        )}

        {!treeLoaded && <CloudSkeleton view={view} />}

        {treeLoaded && !isEmpty && view === "list" && (
          <EntityTable
            items={[...folderItems, ...fileItems]}
            hrefFor={hrefFor}
            actionsFor={actionsFor}
            enableDnd={canEdit}
            selection={tableSelection}
          />
        )}

        {treeLoaded && view === "grid" && folderItems.length > 0 && (
          <section className="space-y-3">
            <SectionLabel>Folders</SectionLabel>
            {renderGrid(folderItems, "folder")}
          </section>
        )}

        {treeLoaded && view === "grid" && fileItems.length > 0 && (
          <section className="space-y-3">
            <SectionLabel>Files &amp; pages</SectionLabel>
            {renderGrid(fileItems, "file")}
          </section>
        )}

        {treeLoaded && isEmpty && (
          <EmptyState
            canEdit={canEdit}
            isFolder={Boolean(selectedFolder)}
            onUpload={() => inputRef.current?.click()}
            onNewPage={() => createPage(folderId)}
          />
        )}
      </ViewContainer>

        <DragOverlay dropAnimation={null}>
          {activeDrag ? (
            <div className="rounded-md border border-border bg-popover px-2 py-1 text-sm shadow-md">
              {activeDrag.title ?? "Moving item…"}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {canEdit && (
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      )}

      {dragging && (
        // Full-cover catcher: once a file drag begins this sits above the cards
        // (incl. PDF preview iframes, which otherwise swallow native drag events)
        // and owns the dragover/drop so the drop zone stays reliable.
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-primary/5 backdrop-blur-[1px]"
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
              setDragging(false);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragging(false);
            if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
          }}
        >
          <div className="pointer-events-none flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-primary/50 bg-background/80 px-10 py-8 text-primary shadow-lg">
            <Upload className="size-7" />
            <p className="text-sm font-medium">Drop files to upload</p>
            <p className="text-xs text-muted-foreground">
              {selectedFolder ? `Into ${selectedFolder.name}` : "Into this library"}
            </p>
          </div>
        </div>
      )}

      {canEdit && selectionActive && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-popover/95 py-1.5 pl-4 pr-1.5 shadow-lg backdrop-blur">
            <span className="text-sm font-medium">
              {selectedItems.length} selected
            </span>
            <span className="mx-1.5 h-5 w-px bg-border" aria-hidden />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setBulkMoveOpen(true)}
              disabled={selectableCount === 0}
            >
              <FolderInput className="size-4" />
              Move
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={clearSelection}
              aria-label="Clear selection"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={bulkDeleteOpen}
        title={`Delete ${selectedItems.length} item${selectedItems.length === 1 ? "" : "s"}?`}
        description="The selected items will be permanently deleted. Folders will also delete everything inside them."
        loading={bulkBusy}
        onOpenChange={(open) => !open && !bulkBusy && setBulkDeleteOpen(false)}
        onConfirm={handleBulkDelete}
      />

      <MoveModal
        open={bulkMoveOpen}
        item={{ type: "document", id: "", title: `${selectableCount} item${selectableCount === 1 ? "" : "s"}` }}
        folders={folders}
        currentFolderId={folderId}
        libraryName={activeLibrary?.name ?? "Library"}
        onOpenChange={(open) => !open && setBulkMoveOpen(false)}
        onMove={handleBulkMove}
      />
    </ViewScroll>
  );
}

function QuickActions({
  onNewPage,
  onNewBoard,
  onNewDeck,
  onNewDatabase,
  onNewFlowchart,
  onNewFolder,
  onUpload,
}: {
  onNewPage: () => void | Promise<void>;
  onNewBoard: () => void | Promise<void>;
  onNewDeck: () => void | Promise<void>;
  onNewDatabase: () => void | Promise<void>;
  onNewFlowchart: () => void | Promise<void>;
  onNewFolder: () => void;
  onUpload: () => void;
}) {
  const [creating, setCreating] = useState(false);

  async function handleNewPage() {
    if (creating) return;
    setCreating(true);
    try {
      await onNewPage();
    } finally {
      setCreating(false);
    }
  }

  const cardClass =
    "group flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 text-left transition-colors hover:border-border hover:bg-accent/50 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <DropdownMenu>
        <DropdownMenuTrigger render={<button type="button" className={cardClass} />}>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {creating ? <Loader2 className="size-5 animate-spin" /> : <FilePlus className="size-5" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-foreground">New</span>
            <span className="block truncate text-xs text-muted-foreground">
              Create a page or folder
            </span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60 **:[[role=menuitem]]:gap-3 **:[[role=menuitem]]:py-2.5 **:[[role=menuitem]]:text-sm">
          <DropdownMenuItem onClick={handleNewPage}>
            <FileArtwork type="PAGE" className="size-5" />
            New page
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onNewBoard}>
            <FileArtwork type="WHITEBOARD" className="size-5" />
            New whiteboard
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onNewDeck}>
            <FileArtwork type="DECK" className="size-5" />
            New deck
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onNewDatabase}>
            <FileArtwork type="DATABASE" className="size-5" />
            New database
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onNewFlowchart}>
            <FileArtwork type="FLOWCHART" className="size-5" />
            New flowchart
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onNewFolder}>
            <FolderArtwork color="yellow" className="size-5" />
            New folder
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <button type="button" onClick={onUpload} className={cardClass}>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500 dark:text-orange-400">
          <CloudUpload className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">Upload</span>
          <span className="block truncate text-xs text-muted-foreground">Upload local files</span>
        </span>
      </button>
    </div>
  );
}

function CloudSkeleton({ view }: { view: ViewMode }) {
  if (view === "list") {
    return (
      <div className="overflow-hidden rounded-lg border border-border">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0"
          >
            <Skeleton className="size-5 shrink-0 rounded" />
            <Skeleton className="h-4 flex-1" style={{ maxWidth: `${40 + ((i * 13) % 45)}%` }} />
            <Skeleton className="ml-auto hidden h-3 w-16 sm:block" />
            <Skeleton className="hidden h-3 w-20 md:block" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Skeleton className="h-3.5 w-16" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-border">
            <Skeleton className="aspect-4/3 w-full rounded-none" />
            <div className="flex items-center gap-2.5 px-2.5 py-2">
              <Skeleton className="size-7 shrink-0 rounded-md" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-3" style={{ maxWidth: `${55 + ((i * 17) % 35)}%` }} />
                <Skeleton className="h-2.5 w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({
  canEdit,
  isFolder,
  onUpload,
  onNewPage,
}: {
  canEdit: boolean;
  isFolder: boolean;
  onUpload: () => void;
  onNewPage: () => void | Promise<void>;
}) {
  const [creating, setCreating] = useState(false);

  async function handleNewPage() {
    if (creating) return;
    setCreating(true);
    try {
      await onNewPage();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
      <div className="flex items-center gap-1.5 text-muted-foreground/70">
        <FolderClosed className="size-7" />
        <FileText className="size-7" />
      </div>
      <p className="mt-4 text-sm font-medium text-foreground">
        {isFolder ? "This folder is empty" : "Your library is empty"}
      </p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {canEdit
          ? "Create a page or drag files anywhere to upload them."
          : "Nothing has been shared here yet."}
      </p>
      {canEdit && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Button onClick={handleNewPage} disabled={creating}>
            {creating && <Loader2 className="size-4 animate-spin" />}
            {creating ? "Creating…" : "New page"}
          </Button>
          <Button variant="outline" onClick={onUpload}>
            <Upload className="size-4" />
            Upload files
          </Button>
        </div>
      )}
    </div>
  );
}
