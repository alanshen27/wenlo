"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  ChevronDown,
  ChevronRight,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FolderIcon } from "@/components/icons/folder-icon";
import type { FolderNode } from "@/lib/folders";
import { getDocumentIcon, getDocumentIconClass, PageIcon } from "@/lib/file-icons";
import { LibrarySwitcher, type Library } from "@/components/sidebar/library-switcher";
import { SidebarFooter } from "@/components/sidebar/sidebar-footer";
import {
  folderDropId,
  itemDragId,
  parseFolderDropId,
  parseItemDragId,
  type SidebarDragItem,
} from "@/lib/sidebar-dnd";

type FolderRef = { id: string; name: string; color: string };
type ItemRef = { id: string; title: string };

type Props = {
  libraries: Library[];
  activeLibraryId: string | null;
  onSelectLibrary: (id: string) => void;
  onCreateLibrary: () => void;
  onEditLibrary: (library: Library) => void;
  onDeleteLibrary: (library: Library) => void;
  tree: FolderNode[];
  selectedFolderId: string | null;
  selectedPageId: string | null;
  selectedDocumentId: string | null;
  onSelectFolder: (id: string | null) => void;
  onSelectPage: (id: string) => void;
  onSelectDocument: (id: string) => void;
  onCreateFolder: (parentId: string | null) => void;
  onEditFolder: (folder: FolderRef) => void;
  onDeleteFolder: (folder: ItemRef) => void;
  onCreatePage: (folderId: string | null) => void;
  onDeletePage: (page: ItemRef) => void;
  onDeleteDocument: (doc: ItemRef) => void;
  onMoveItem: (item: SidebarDragItem, folderId: string | null) => void | Promise<void>;
  onUploadToFolder: (folderId: string | null, files: FileList | File[]) => void | Promise<void>;
  activeNav: "search" | "recall" | null;
  onOpenSearch: () => void;
  onOpenRecall: () => void;
};

export function FolderSidebar(props: Props) {
  const {
    libraries,
    activeLibraryId,
    onSelectLibrary,
    onCreateLibrary,
    onEditLibrary,
    onDeleteLibrary,
    tree,
    selectedFolderId,
    selectedPageId,
    selectedDocumentId,
    onSelectFolder,
    onSelectPage,
    onSelectDocument,
    onCreateFolder,
    onEditFolder,
    onDeleteFolder,
    onCreatePage,
    onDeletePage,
    onDeleteDocument,
    onMoveItem,
    onUploadToFolder,
    activeNav,
    onOpenSearch,
    onOpenRecall,
  } = props;

  const [activeDrag, setActiveDrag] = useState<SidebarDragItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const activeLibrary = libraries.find((l) => l.id === activeLibraryId);

  async function handleDragEnd(event: DragEndEvent) {
    setActiveDrag(null);
    const parsed = parseItemDragId(event.active.id);
    if (!parsed || !event.over) return;

    const data = event.active.data.current as SidebarDragItem | undefined;
    const item: SidebarDragItem = {
      ...parsed,
      title: data?.title,
      docType: data?.docType,
    };
    if (!item.title) return;

    const folderId = parseFolderDropId(event.over.id);
    if (folderId === undefined) return;
    await onMoveItem(item, folderId);
  }

  function handleDragStart(event: DragStartEvent) {
    const item = parseItemDragId(event.active.id);
    if (item) {
      const data = event.active.data.current as SidebarDragItem | undefined;
      setActiveDrag({
        ...item,
        title: data?.title,
        docType: data?.docType,
      });
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDrag(null)}
    >
      <aside className="flex h-full min-h-0 w-[240px] shrink-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground">
        <div className="flex shrink-0 items-center gap-1 px-2 py-2">
          <div className="min-w-0 flex-1">
            <LibrarySwitcher
              libraries={libraries}
              activeLibraryId={activeLibraryId}
              onSelect={onSelectLibrary}
              onCreate={onCreateLibrary}
            />
          </div>
          {activeLibrary && (
            <ItemMenu
              items={[
                {
                  label: "Edit library",
                  icon: Pencil,
                  onClick: () => onEditLibrary(activeLibrary),
                },
                {
                  label: "Delete library",
                  icon: Trash2,
                  variant: "destructive" as const,
                  onClick: () => onDeleteLibrary(activeLibrary),
                },
              ]}
            />
          )}
        </div>

        <div className="shrink-0 space-y-0.5 px-2 pb-2">
          <Button
            variant="ghost"
            className={cn(
              "h-8 w-full justify-start gap-2 px-2",
              activeNav === "search"
                ? "sidebar-item-active font-medium text-sidebar-foreground"
                : "text-muted-foreground"
            )}
            onClick={onOpenSearch}
          >
            <Search className="size-4" />
            Search
          </Button>
          <Button
            variant="ghost"
            className={cn(
              "h-8 w-full justify-start gap-2 px-2",
              activeNav === "recall"
                ? "bg-violet-500/10 font-medium text-violet-700 dark:text-violet-300"
                : "text-muted-foreground hover:bg-violet-500/5 hover:text-violet-700 dark:hover:text-violet-300"
            )}
            onClick={onOpenRecall}
          >
            <Sparkles className="size-4" />
            Recall
          </Button>
        </div>

        <Separator className="shrink-0" />

        <FolderDropTarget
          folderId={null}
          className="mx-1 flex shrink-0 items-center justify-between rounded-md px-2 py-2"
          onUpload={onUploadToFolder}
        >
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Private
          </span>
          <div className="flex gap-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              title="New folder"
              onClick={() => onCreateFolder(selectedFolderId)}
            >
              <FolderPlus className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              title="New page"
              onClick={() => onCreatePage(selectedFolderId)}
            >
              <Plus className="size-3.5" />
            </Button>
          </div>
        </FolderDropTarget>

        <ScrollArea className="min-h-0 flex-1 px-1">
          <nav className="pb-2 text-sm">
            {tree.map((node) => (
              <FolderTreeNode
                key={node.id}
                node={node}
                depth={0}
                selectedFolderId={selectedFolderId}
                selectedPageId={selectedPageId}
                selectedDocumentId={selectedDocumentId}
                onSelectFolder={onSelectFolder}
                onSelectPage={onSelectPage}
                onSelectDocument={onSelectDocument}
                onCreateFolder={onCreateFolder}
                onEditFolder={onEditFolder}
                onDeleteFolder={onDeleteFolder}
                onCreatePage={onCreatePage}
                onDeletePage={onDeletePage}
                onDeleteDocument={onDeleteDocument}
                onUploadToFolder={onUploadToFolder}
              />
            ))}
          </nav>
        </ScrollArea>

        <div className="shrink-0">
          <SidebarFooter />
        </div>
      </aside>

      <DragOverlay dropAnimation={null}>
        {activeDrag ? (
          <div className="rounded-md border border-border bg-popover px-2 py-1 text-sm shadow-md">
            {activeDrag.title ?? "Moving item…"}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function FolderDropTarget({
  folderId,
  className,
  style,
  onUpload,
  children,
}: {
  folderId: string | null;
  className?: string;
  style?: React.CSSProperties;
  onUpload: (folderId: string | null, files: FileList | File[]) => void | Promise<void>;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: folderDropId(folderId),
    data: { folderId },
  });

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        className,
        "transition-colors",
        isOver && "bg-primary/10 ring-1 ring-inset ring-primary/40"
      )}
      onDragOver={(e) => {
        if (Array.from(e.dataTransfer.types).includes("Files")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        e.stopPropagation();
        void onUpload(folderId, e.dataTransfer.files);
      }}
    >
      {children}
    </div>
  );
}

function DraggableItemRow({
  item,
  className,
  style,
  children,
}: {
  item: SidebarDragItem;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: itemDragId(item),
    data: item,
  });

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(className, isDragging && "opacity-40")}
      {...listeners}
      {...attributes}
    >
      {children}
    </div>
  );
}

function ItemMenu({
  items,
  open,
  onOpenChange,
}: {
  items: Array<{
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick: () => void;
    variant?: "default" | "destructive";
  }>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" className="shrink-0" />}
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {items.map((item) => (
          <DropdownMenuItem
            key={item.label}
            variant={item.variant}
            onClick={item.onClick}
          >
            <item.icon className="size-3.5" />
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RowActions({
  children,
}: {
  children: (ctx: {
    menuOpen: boolean;
    setMenuOpen: (open: boolean) => void;
  }) => React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-0.5 transition-opacity",
        menuOpen
          ? "pointer-events-auto opacity-100"
          : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100"
      )}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children({ menuOpen, setMenuOpen })}
    </div>
  );
}

function FolderTreeNode({
  node,
  depth,
  selectedFolderId,
  selectedPageId,
  selectedDocumentId,
  onSelectFolder,
  onSelectPage,
  onSelectDocument,
  onCreateFolder,
  onEditFolder,
  onDeleteFolder,
  onCreatePage,
  onDeletePage,
  onDeleteDocument,
  onUploadToFolder,
}: {
  node: FolderNode;
  depth: number;
  selectedFolderId: string | null;
  selectedPageId: string | null;
  selectedDocumentId: string | null;
  onSelectFolder: (id: string | null) => void;
  onSelectPage: (id: string) => void;
  onSelectDocument: (id: string) => void;
  onCreateFolder: (parentId: string | null) => void;
  onEditFolder: (folder: FolderRef) => void;
  onDeleteFolder: (folder: ItemRef) => void;
  onCreatePage: (folderId: string | null) => void;
  onDeletePage: (page: ItemRef) => void;
  onDeleteDocument: (doc: ItemRef) => void;
  onUploadToFolder: (folderId: string | null, files: FileList | File[]) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(true);
  const isRoot = node.id === "__root__";
  const isSelected =
    !isRoot &&
    selectedFolderId === node.id &&
    !selectedPageId &&
    !selectedDocumentId;

  return (
    <div>
      {!isRoot && (
        <FolderDropTarget
          folderId={node.id}
          className={cn(
            "group sidebar-item flex items-center gap-0.5 py-0.5 pr-1",
            isSelected && "sidebar-item-active font-medium"
          )}
          style={{ paddingLeft: depth * 12 + 4 }}
          onUpload={onUploadToFolder}
        >
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-6 shrink-0 text-muted-foreground"
            onClick={() => setOpen(!open)}
          >
            {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </Button>
          <Button
            variant="ghost"
            className="h-auto min-w-0 flex-1 justify-start gap-1.5 truncate px-1 py-0.5 font-normal"
            onClick={() => onSelectFolder(node.id)}
          >
            <FolderIcon color={node.color} />
            <span className="truncate">{node.name}</span>
          </Button>
          <RowActions>
            {({ menuOpen, setMenuOpen }) => (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-6"
                  title="Add subfolder"
                  onClick={() => onCreateFolder(node.id)}
                >
                  <FolderPlus className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-6"
                  title="Add page"
                  onClick={() => onCreatePage(node.id)}
                >
                  <Plus className="size-3" />
                </Button>
                <ItemMenu
                  open={menuOpen}
                  onOpenChange={setMenuOpen}
                  items={[
                    {
                      label: "Edit",
                      icon: Pencil,
                      onClick: () =>
                        onEditFolder({ id: node.id, name: node.name, color: node.color }),
                    },
                    {
                      label: "Delete",
                      icon: Trash2,
                      variant: "destructive",
                      onClick: () => onDeleteFolder({ id: node.id, title: node.name }),
                    },
                  ]}
                />
              </>
            )}
          </RowActions>
        </FolderDropTarget>
      )}

      {open && (
        <>
          {node.pages.map((page) => (
            <DraggableItemRow
              key={page.id}
              item={{ type: "page", id: page.id, title: page.title }}
              className={cn(
                "group sidebar-item flex cursor-grab items-center gap-1 py-0.5 pr-1 active:cursor-grabbing",
                selectedPageId === page.id && "sidebar-item-active font-medium"
              )}
              style={{ paddingLeft: (isRoot ? depth : depth + 1) * 12 + 24 }}
            >
              <Button
                variant="ghost"
                className="h-auto min-w-0 flex-1 justify-start gap-1.5 truncate px-1 py-1 font-normal"
                onClick={() => onSelectPage(page.id)}
              >
                <PageIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{page.title}</span>
              </Button>
              <RowActions>
                {({ menuOpen, setMenuOpen }) => (
                  <ItemMenu
                    open={menuOpen}
                    onOpenChange={setMenuOpen}
                    items={[
                      {
                        label: "Delete",
                        icon: Trash2,
                        variant: "destructive",
                        onClick: () => onDeletePage({ id: page.id, title: page.title }),
                      },
                    ]}
                  />
                )}
              </RowActions>
            </DraggableItemRow>
          ))}
          {node.documents.map((doc) => {
            const DocIcon = getDocumentIcon(doc.type);
            const row = (
              <>
                <Button
                  variant="ghost"
                  disabled={doc.pending}
                  className="h-auto min-w-0 flex-1 justify-start gap-1.5 truncate px-1 py-1 font-normal"
                  onClick={() => !doc.pending && onSelectDocument(doc.id)}
                >
                  <DocIcon className={cn("size-4 shrink-0", getDocumentIconClass(doc.type))} />
                  <span className="truncate">{doc.pending ? `Uploading ${doc.title}…` : doc.title}</span>
                </Button>
                {!doc.pending && (
                  <RowActions>
                    {({ menuOpen, setMenuOpen }) => (
                      <ItemMenu
                        open={menuOpen}
                        onOpenChange={setMenuOpen}
                        items={[
                          {
                            label: "Delete",
                            icon: Trash2,
                            variant: "destructive",
                            onClick: () => onDeleteDocument({ id: doc.id, title: doc.title }),
                          },
                        ]}
                      />
                    )}
                  </RowActions>
                )}
              </>
            );

            if (doc.pending) {
              return (
                <div
                  key={doc.id}
                  className={cn(
                    "sidebar-item flex items-center gap-1 py-0.5 pr-1 opacity-60",
                    selectedDocumentId === doc.id && "sidebar-item-active font-medium"
                  )}
                  style={{ paddingLeft: (isRoot ? depth : depth + 1) * 12 + 24 }}
                >
                  {row}
                </div>
              );
            }

            return (
              <DraggableItemRow
                key={doc.id}
                item={{ type: "document", id: doc.id, title: doc.title, docType: doc.type }}
                className={cn(
                  "group sidebar-item flex cursor-grab items-center gap-1 py-0.5 pr-1 active:cursor-grabbing",
                  selectedDocumentId === doc.id && "sidebar-item-active font-medium"
                )}
                style={{ paddingLeft: (isRoot ? depth : depth + 1) * 12 + 24 }}
              >
                {row}
              </DraggableItemRow>
            );
          })}
          {node.children.map((child) => (
            <FolderTreeNode
              key={child.id}
              node={child}
              depth={isRoot ? depth : depth + 1}
              selectedFolderId={selectedFolderId}
              selectedPageId={selectedPageId}
              selectedDocumentId={selectedDocumentId}
              onSelectFolder={onSelectFolder}
              onSelectPage={onSelectPage}
              onSelectDocument={onSelectDocument}
              onCreateFolder={onCreateFolder}
              onEditFolder={onEditFolder}
              onDeleteFolder={onDeleteFolder}
              onCreatePage={onCreatePage}
              onDeletePage={onDeletePage}
              onDeleteDocument={onDeleteDocument}
              onUploadToFolder={onUploadToFolder}
            />
          ))}
        </>
      )}
    </div>
  );
}
