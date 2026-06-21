"use client";

import { useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
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
  House,
  Loader2,
  MessageSquare,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/core/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FolderNode } from "@/lib/library/folders";
import { FileArtwork, FolderArtwork } from "@/lib/client/file-icons";
import { LibrarySwitcher } from "@/components/sidebar/library-switcher";
import { AppLauncher } from "@/components/native/app-launcher";
import { SidebarFooter } from "@/components/sidebar/sidebar-footer";
import { useRecallChatOptional } from "@/components/recall/recall-chat-context";
import {
  useLibraryActions,
  useLibraryScope,
  useLibraryTree,
} from "@/components/library/context";
import { sessionLabel } from "@/lib/recall-chat/recall-chat-ui";
import {
  documentOpenRoute,
  folderHome,
  libraryHome,
  pageRoute,
  persistActiveLibrary,
  recallRoute,
  searchRoute,
} from "@/lib/client/routes";
import { findItemInTree } from "@/lib/client/tree-mutations";
import type { FolderColorId } from "@/lib/library/folder-colors";
import {
  dragItemFromData,
  folderDropId,
  itemDragId,
  resolveFolderDrop,
} from "@/lib/client/sidebar-dnd";
import type { FolderItem } from "@/lib/library/folders";

type FolderRef = { id: string; name: string; color: string };
type ItemRef = { id: string; title: string };

function SidebarTreeSkeleton() {
  const rows = [
    { indent: 0, width: "60%" },
    { indent: 1, width: "45%" },
    { indent: 1, width: "55%" },
    { indent: 0, width: "50%" },
    { indent: 0, width: "70%" },
    { indent: 1, width: "40%" },
    { indent: 0, width: "52%" },
  ];
  return (
    <div className="space-y-1 px-1 py-1">
      {rows.map((row, i) => (
        <div
          key={i}
          className="flex items-center gap-2 py-1"
          style={{ paddingLeft: `${row.indent * 16 + 4}px` }}
        >
          <Skeleton className="size-4 shrink-0 rounded" />
          <Skeleton className="h-3.5" style={{ width: row.width }} />
        </div>
      ))}
    </div>
  );
}

/** Library folder tree sidebar — reads split library contexts; route state from URL. */
export function FolderSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{
    libraryId: string;
    folderId?: string;
    pageId?: string;
    documentId?: string;
    boardId?: string;
  }>();

  const libraryId = params.libraryId;
  const selectedFolderId = params.folderId ?? null;
  const selectedPageId = params.pageId ?? null;
  const selectedDocumentId = params.documentId ?? params.boardId ?? null;

  const isSearchPage = pathname.endsWith("/search");
  const isRecallPage = pathname.endsWith("/recall");
  const isFilesHome =
    !isSearchPage && !isRecallPage && !selectedPageId && !selectedDocumentId;
  const activeNav = isSearchPage
    ? "search"
    : isRecallPage
      ? "recall"
      : isFilesHome
        ? "home"
        : null;

  const { libraries, canEdit } = useLibraryScope();
  const { tree, treeLoaded, moveItem, uploadToFolder } = useLibraryTree();
  const {
    createPage,
    beginCreateFolder,
    beginEditFolder,
    beginDeleteFolder,
    beginDeletePage,
    beginDeleteDocument,
    openLibraryCreate,
    openLibraryEdit,
    openLibraryDelete,
    openShareLibrary,
  } = useLibraryActions();

  const treeLoading = !treeLoaded;
  const recallChat = useRecallChatOptional();

  const onSelectLibrary = (id: string) => {
    persistActiveLibrary(id);
    router.push(libraryHome(id));
  };

  const onOpenHome = () => router.push(libraryHome(libraryId));
  const onOpenSearch = () => router.push(searchRoute(libraryId));
  const onOpenRecall = () => router.push(recallRoute(libraryId));
  const onSelectFolder = (id: string | null) => {
    if (id) router.push(folderHome(libraryId, id));
    else router.push(libraryHome(libraryId));
  };
  const onSelectPage = (id: string) => router.push(pageRoute(libraryId, id));
  const onSelectDocument = (id: string) => {
    const found = findItemInTree(tree, { kind: "document", id });
    router.push(documentOpenRoute(libraryId, id, found?.type));
  };

  const handleEditFolder = (folder: FolderRef) =>
    beginEditFolder({
      id: folder.id,
      name: folder.name,
      color: folder.color as FolderColorId,
    });
  const handleDeleteFolder = (folder: ItemRef) =>
    beginDeleteFolder({ id: folder.id, name: folder.title });

  const [activeDrag, setActiveDrag] = useState<FolderItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const activeLibrary = libraries.find((l) => l.id === libraryId);

  async function handleDragEnd(event: DragEndEvent) {
    setActiveDrag(null);
    const drop = resolveFolderDrop(event);
    if (!drop) return;
    await moveItem(drop.item, drop.targetFolderId);
  }

  function handleDragStart(event: DragStartEvent) {
    const item = dragItemFromData(event.active.data.current);
    if (item) setActiveDrag(item);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDrag(null)}
    >
      <aside className="flex h-full min-h-0 w-[240px] shrink-0 flex-col overflow-hidden border-r bg-sidebar text-sidebar-foreground">
        <div className="flex shrink-0 items-center gap-1 px-2 py-2">
          <div className="min-w-0 flex-1">
            <LibrarySwitcher
              libraries={libraries}
              activeLibraryId={libraryId}
              onSelect={onSelectLibrary}
              onCreate={openLibraryCreate}
              onShare={openShareLibrary}
            />
          </div>
          <AppLauncher />
          {activeLibrary && activeLibrary.role === "OWNER" && (
            <ItemMenu
              items={[
                {
                  label: "Edit library",
                  icon: Pencil,
                  onClick: () => openLibraryEdit(activeLibrary),
                },
                {
                  label: "Delete library",
                  icon: Trash2,
                  variant: "destructive" as const,
                  onClick: () => openLibraryDelete(activeLibrary),
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
              activeNav === "home"
                ? "sidebar-item-active font-medium text-sidebar-foreground"
                : "text-muted-foreground"
            )}
            onClick={onOpenHome}
          >
            <House className="size-4" />
            Home
          </Button>
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
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-primary/5 hover:text-primary"
            )}
            onClick={onOpenRecall}
          >
            <Sparkles className="size-4" />
            Recall
          </Button>
          {activeNav === "recall" && recallChat && (
            <div className="ml-2 space-y-0.5 border-l border-border pl-2">
              {recallChat.sessionError && (
                <p className="px-2 py-1 text-[11px] leading-snug text-destructive">
                  {recallChat.sessionError}
                </p>
              )}
              {recallChat.loadingSessions && (
                <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Loading…
                </div>
              )}
              {!recallChat.loadingSessions && recallChat.sessions.length === 0 && (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">No chats yet</p>
              )}
              {recallChat.sessions.map((session) => (
                <div
                  key={session.id}
                  className={cn(
                    "group flex h-8 items-center gap-0.5 rounded-md pr-1 hover:bg-sidebar-accent",
                    recallChat.activeSessionId === session.id &&
                      "sidebar-item-active font-medium text-sidebar-foreground"
                  )}
                >
                  <button
                    type="button"
                    className="flex h-full min-w-0 flex-1 items-center justify-start gap-2 px-2 text-left"
                    onClick={() => recallChat.selectSession(session.id)}
                  >
                    <MessageSquare className="size-3.5 shrink-0 opacity-60" />
                    <span className="truncate text-sm">{sessionLabel(session)}</span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0 opacity-0 hover:bg-transparent group-hover:opacity-100"
                    title="Delete chat"
                    onClick={(e) => {
                      e.stopPropagation();
                      void recallChat.deleteSession(session.id);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
                              <Button
                  type="button"
                  variant="ghost"
                  className="text-muted-foreground text-sm w-full"
                  title="New chat"
                  onClick={() => void recallChat.newChat()}
                >
                  New Chat
                  <MessageSquarePlus className="size-4" />
                </Button>
            </div>
          )}
        </div>

        <Separator className="shrink-0" />

        <FolderDropTarget
          folderId={null}
          className="mx-1 flex shrink-0 items-center justify-between rounded-md px-2 py-2"
          onUpload={uploadToFolder}
        >
          <span className="text-xs font-medium text-muted-foreground">
            {canEdit ? "Private" : "Shared"}
          </span>
          {canEdit && (
            <div className="flex gap-0.5">
              <Button
                variant="ghost"
                size="icon-sm"
                title="New folder"
                onClick={() => beginCreateFolder(selectedFolderId)}
              >
                <FolderPlus className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                title="New page"
                onClick={() => createPage(selectedFolderId)}
              >
                <Plus className="size-3.5" />
              </Button>
            </div>
          )}
        </FolderDropTarget>

        <ScrollArea className="min-h-0 flex-1 px-1">
          <nav className="pb-2 text-sm">
            {treeLoading && tree.length === 0 && <SidebarTreeSkeleton />}
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
                onCreateFolder={beginCreateFolder}
                onEditFolder={handleEditFolder}
                onDeleteFolder={handleDeleteFolder}
                onCreatePage={createPage}
                onDeletePage={beginDeletePage}
                onDeleteDocument={beginDeleteDocument}
                onUploadToFolder={uploadToFolder}
                canEdit={canEdit}
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
  item: FolderItem;
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

function SidebarItemLabel({
  className,
  children,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "flex min-w-0 flex-1 select-none items-center gap-1.5 truncate rounded-sm px-1 py-0.5 text-left text-sm font-normal text-inherit outline-none focus-visible:ring-1 focus-visible:ring-ring/50",
        className
      )}
      {...props}
    >
      {children}
    </button>
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
  canEdit = true,
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
  canEdit?: boolean;
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
          <SidebarItemLabel className="py-1" onClick={() => onSelectFolder(node.id)}>
            <FolderArtwork color={node.color} className="size-4 shrink-0" />
            <span className="truncate">{node.name}</span>
          </SidebarItemLabel>
          <RowActions>
            {({ menuOpen, setMenuOpen }) => (
              <>
                {canEdit && (
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
              item={{ kind: "page", id: page.id, title: page.title }}
              className={cn(
                "group sidebar-item flex cursor-grab items-center gap-1 py-0.5 pr-1 active:cursor-grabbing",
                selectedPageId === page.id && "sidebar-item-active font-medium"
              )}
              style={{ paddingLeft: (isRoot ? depth : depth + 1) * 12 + 30 }}
            >
              <SidebarItemLabel
                className="py-1"
                onClick={() => onSelectPage(page.id)}
              >
                <FileArtwork type="PAGE" className="size-4 shrink-0" />
                <span className="truncate">{page.title}</span>
              </SidebarItemLabel>
              <RowActions>
                {({ menuOpen, setMenuOpen }) =>
                  canEdit ? (
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
                  ) : null
                }
              </RowActions>
            </DraggableItemRow>
          ))}
          {node.documents.map((doc) => {
            const row = (
              <>
                <SidebarItemLabel
                  className="py-1"
                  disabled={doc.pending}
                  onClick={() => !doc.pending && onSelectDocument(doc.id)}
                >
                  <FileArtwork
                    type={doc.type}
                    className={cn("size-4 shrink-0", doc.pending && "animate-pulse")}
                  />
                  <span className="truncate">
                    {doc.pending ? `Uploading ${doc.title}…` : doc.title}
                  </span>
                  {(doc.pending || doc.processing) && (
                    <Loader2
                      className="ml-auto size-3.5 shrink-0 animate-spin text-muted-foreground"
                      aria-label={doc.pending ? "Uploading" : "Processing"}
                    />
                  )}
                </SidebarItemLabel>
                {!doc.pending && canEdit && (
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
                  style={{ paddingLeft: (isRoot ? depth : depth + 1) * 12 + 30 }}
                >
                  {row}
                </div>
              );
            }

            return (
              <DraggableItemRow
                key={doc.id}
                item={{ kind: "document", id: doc.id, title: doc.title, type: doc.type }}
                className={cn(
                  "group sidebar-item flex cursor-grab items-center gap-1 py-0.5 pr-1 active:cursor-grabbing",
                  selectedDocumentId === doc.id && "sidebar-item-active font-medium"
                )}
                style={{ paddingLeft: (isRoot ? depth : depth + 1) * 12 + 30 }}
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
              canEdit={canEdit}
            />
          ))}
        </>
      )}
    </div>
  );
}
