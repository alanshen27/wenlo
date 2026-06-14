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
  Files,
  FolderPlus,
  House,
  Loader2,
  MessageSquare,
  MessageSquarePlus,
  MoreHorizontal,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePersistentState } from "@/lib/use-persistent-state";
import { FolderIcon } from "@/components/icons/folder-icon";
import type { FolderNode } from "@/lib/folders";
import {
  FileArtwork,
  FolderArtwork,
  getDocumentIcon,
  getDocumentIconClass,
  PageIcon,
} from "@/lib/file-icons";
import { LibrarySwitcher, type Library } from "@/components/sidebar/library-switcher";
import { SidebarFooter } from "@/components/sidebar/sidebar-footer";
import { useRecallChat } from "@/components/recall/recall-chat-context";
import { sessionLabel } from "@/lib/recall-chat-ui";
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
  onShareLibrary?: () => void;
  onEditLibrary: (library: Library) => void;
  onDeleteLibrary: (library: Library) => void;
  canEdit?: boolean;
  tree: FolderNode[];
  treeLoading?: boolean;
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
  activeNav: "search" | "recall" | "map" | "home" | null;
  onOpenHome: () => void;
  onOpenSearch: () => void;
  onOpenRecall: () => void;
  onOpenMindMap: () => void;
};

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

export function FolderSidebar(props: Props) {
  const {
    libraries,
    activeLibraryId,
    onSelectLibrary,
    onCreateLibrary,
    onShareLibrary,
    onEditLibrary,
    onDeleteLibrary,
    canEdit = true,
    tree,
    treeLoading = false,
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
    onOpenHome,
    onOpenSearch,
    onOpenRecall,
    onOpenMindMap,
  } = props;

  const [activeDrag, setActiveDrag] = useState<SidebarDragItem | null>(null);
  const [collapsed, setCollapsed, collapsedHydrated] = usePersistentState<boolean>(
    "recalls:sidebar-collapsed",
    false
  );
  const recallChat = useRecallChat();

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
      <aside
        className={cn(
          "flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-r bg-sidebar text-sidebar-foreground",
          collapsed ? "w-[60px]" : "w-[240px]",
          collapsedHydrated && "transition-[width] duration-200 ease-out"
        )}
      >
        {collapsed ? (
          <CollapsedRail
            tree={tree}
            activeNav={activeNav}
            selectedFolderId={selectedFolderId}
            selectedPageId={selectedPageId}
            selectedDocumentId={selectedDocumentId}
            onExpand={() => setCollapsed(false)}
            onOpenHome={onOpenHome}
            onOpenSearch={onOpenSearch}
            onOpenRecall={onOpenRecall}
            onOpenMindMap={onOpenMindMap}
            onSelectFolder={onSelectFolder}
            onSelectPage={onSelectPage}
            onSelectDocument={onSelectDocument}
          />
        ) : (
          <>
        <div className="flex shrink-0 items-center gap-1 px-2 py-2">
          <div className="min-w-0 flex-1">
            <LibrarySwitcher
              libraries={libraries}
              activeLibraryId={activeLibraryId}
              onSelect={onSelectLibrary}
              onCreate={onCreateLibrary}
              onShare={onShareLibrary}
            />
          </div>
          {activeLibrary && activeLibrary.role === "OWNER" && (
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
          <Button
            variant="ghost"
            size="icon-sm"
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
            onClick={() => setCollapsed(true)}
          >
            <PanelLeftClose className="size-4" />
          </Button>
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
                ? "bg-violet-500/10 font-medium text-violet-700 dark:text-violet-300"
                : "text-muted-foreground hover:bg-violet-500/5 hover:text-violet-700 dark:hover:text-violet-300"
            )}
            onClick={onOpenRecall}
          >
            <Sparkles className="size-4" />
            Recall
          </Button>
          {activeNav === "recall" && (
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
                <div key={session.id} className="group flex items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    className={cn(
                      "h-8 min-w-0 flex-1 justify-start gap-2 px-2",
                      recallChat.activeSessionId === session.id &&
                        "sidebar-item-active font-medium text-sidebar-foreground"
                    )}
                    onClick={() => recallChat.selectSession(session.id)}
                  >
                    <MessageSquare className="size-3.5 shrink-0 opacity-60" />
                    <span className="truncate text-sm">{sessionLabel(session)}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="ml-auto shrink-0 opacity-0 group-hover:opacity-100"
                    title="Delete chat"
                    onClick={() => void recallChat.deleteSession(session.id)}
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
          <Button
            variant="ghost"
            className={cn(
              "h-8 w-full justify-start gap-2 px-2",
              activeNav === "map"
                ? "sidebar-item-active font-medium text-sidebar-foreground"
                : "text-muted-foreground"
            )}
            onClick={onOpenMindMap}
          >
            <Network className="size-4" />
            Mind map
          </Button>
        </div>

        <Separator className="shrink-0" />

        <FolderDropTarget
          folderId={null}
          className="mx-1 flex shrink-0 items-center justify-between rounded-md px-2 py-2"
          onUpload={onUploadToFolder}
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
          </nav>
        </ScrollArea>

        <div className="shrink-0">
          <SidebarFooter />
        </div>
          </>
        )}
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

type RailProps = {
  tree: FolderNode[];
  activeNav: Props["activeNav"];
  selectedFolderId: string | null;
  selectedPageId: string | null;
  selectedDocumentId: string | null;
  onExpand: () => void;
  onOpenHome: () => void;
  onOpenSearch: () => void;
  onOpenRecall: () => void;
  onOpenMindMap: () => void;
  onSelectFolder: (id: string | null) => void;
  onSelectPage: (id: string) => void;
  onSelectDocument: (id: string) => void;
};

function CollapsedRail({
  tree,
  activeNav,
  selectedFolderId,
  selectedPageId,
  selectedDocumentId,
  onExpand,
  onOpenHome,
  onOpenSearch,
  onOpenRecall,
  onOpenMindMap,
  onSelectFolder,
  onSelectPage,
  onSelectDocument,
}: RailProps) {
  const rootNode = tree.find((n) => n.id === "__root__");
  const folders = tree.filter((n) => n.id !== "__root__");

  return (
    <div className="flex h-full flex-col items-center gap-1 py-2">
      <RailIconButton icon={PanelLeftOpen} label="Expand sidebar" onClick={onExpand} />

      <Separator className="my-1 w-7" />

      <RailIconButton
        icon={House}
        label="Home"
        active={activeNav === "home"}
        onClick={onOpenHome}
      />
      <RailIconButton
        icon={Search}
        label="Search"
        active={activeNav === "search"}
        onClick={onOpenSearch}
      />
      <RailIconButton
        icon={Sparkles}
        label="Recall"
        accent
        active={activeNav === "recall"}
        onClick={onOpenRecall}
      />
      <RailIconButton
        icon={Network}
        label="Mind map"
        active={activeNav === "map"}
        onClick={onOpenMindMap}
      />

      <Separator className="my-1 w-7" />

      <ScrollArea className="min-h-0 w-full flex-1">
        <div className="flex flex-col items-center gap-1 px-1">
          {folders.map((folder) => (
            <RailStack
              key={folder.id}
              node={folder}
              icon={<FolderIcon color={folder.color} className="size-4" />}
              selectedFolderId={selectedFolderId}
              selectedPageId={selectedPageId}
              selectedDocumentId={selectedDocumentId}
              onSelectFolder={onSelectFolder}
              onSelectPage={onSelectPage}
              onSelectDocument={onSelectDocument}
            />
          ))}
          {rootNode &&
            (rootNode.pages.length > 0 || rootNode.documents.length > 0) && (
              <RailStack
                node={rootNode}
                icon={<Files className="size-4 text-muted-foreground" />}
                selectedFolderId={selectedFolderId}
                selectedPageId={selectedPageId}
                selectedDocumentId={selectedDocumentId}
                onSelectFolder={onSelectFolder}
                onSelectPage={onSelectPage}
                onSelectDocument={onSelectDocument}
              />
            )}
        </div>
      </ScrollArea>
    </div>
  );
}

function RailIconButton({
  icon: Icon,
  label,
  active,
  accent,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  accent?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      title={label}
      aria-label={label}
      className={cn(
        "size-10 rounded-lg",
        accent
          ? active
            ? "bg-violet-500/10 text-violet-700 dark:text-violet-300"
            : "text-muted-foreground hover:bg-violet-500/5 hover:text-violet-700 dark:hover:text-violet-300"
          : active
            ? "sidebar-item-active text-sidebar-foreground"
            : "text-muted-foreground hover:bg-sidebar-hover hover:text-foreground"
      )}
      onClick={onClick}
    >
      <Icon className="size-4" />
    </Button>
  );
}

function RailStack({
  node,
  icon,
  selectedFolderId,
  selectedPageId,
  selectedDocumentId,
  onSelectFolder,
  onSelectPage,
  onSelectDocument,
}: {
  node: FolderNode;
  icon: React.ReactNode;
  selectedFolderId: string | null;
  selectedPageId: string | null;
  selectedDocumentId: string | null;
  onSelectFolder: (id: string | null) => void;
  onSelectPage: (id: string) => void;
  onSelectDocument: (id: string) => void;
}) {
  const isRoot = node.id === "__root__";
  const isActive =
    !isRoot &&
    selectedFolderId === node.id &&
    !selectedPageId &&
    !selectedDocumentId;

  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={100}
        closeDelay={150}
        render={
          <button
            type="button"
            aria-label={node.name}
            onClick={() => {
              if (!isRoot) onSelectFolder(node.id);
            }}
            className={cn(
              "flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-hover hover:text-foreground",
              isActive && "sidebar-item-active text-sidebar-foreground"
            )}
          >
            {icon}
          </button>
        }
      />
      <PopoverContent
        side="right"
        align="start"
        sideOffset={10}
        className="w-64 overflow-hidden p-0"
      >
        <RailFlyout
          node={node}
          isRoot={isRoot}
          onSelectFolder={onSelectFolder}
          onSelectPage={onSelectPage}
          onSelectDocument={onSelectDocument}
        />
      </PopoverContent>
    </Popover>
  );
}

function RailFlyout({
  node,
  isRoot,
  onSelectFolder,
  onSelectPage,
  onSelectDocument,
}: {
  node: FolderNode;
  isRoot: boolean;
  onSelectFolder: (id: string | null) => void;
  onSelectPage: (id: string) => void;
  onSelectDocument: (id: string) => void;
}) {
  const empty =
    node.children.length === 0 &&
    node.pages.length === 0 &&
    node.documents.length === 0;

  return (
    <div className="flex max-h-[60vh] flex-col">
      {isRoot ? (
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Files className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium">Files</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onSelectFolder(node.id)}
          className="flex items-center gap-2 border-b border-border px-3 py-2 text-left transition-colors hover:bg-muted"
        >
          <FolderIcon color={node.color} className="size-4 shrink-0" />
          <span className="truncate text-sm font-medium">{node.name}</span>
        </button>
      )}

      <div className="min-h-0 overflow-y-auto p-1">
        {empty ? (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">
            Empty folder
          </p>
        ) : (
          <>
            {node.children.map((child) => (
              <FlyoutRow key={child.id} onClick={() => onSelectFolder(child.id)}>
                <FolderIcon color={child.color} className="size-4 shrink-0" />
                <span className="truncate">{child.name}</span>
              </FlyoutRow>
            ))}
            {node.pages.map((page) => (
              <FlyoutRow key={page.id} onClick={() => onSelectPage(page.id)}>
                <PageIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{page.title}</span>
              </FlyoutRow>
            ))}
            {node.documents.map((doc) => {
              const DocIcon = getDocumentIcon(doc.type);
              return (
                <FlyoutRow key={doc.id} onClick={() => onSelectDocument(doc.id)}>
                  <DocIcon
                    className={cn("size-4 shrink-0", getDocumentIconClass(doc.type))}
                  />
                  <span className="truncate">{doc.title}</span>
                </FlyoutRow>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

function FlyoutRow({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
    >
      {children}
    </button>
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
              item={{ type: "page", id: page.id, title: page.title }}
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
                item={{ type: "document", id: doc.id, title: doc.title, docType: doc.type }}
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
