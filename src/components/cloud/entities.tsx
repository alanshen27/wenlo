"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import {
  AlertCircle,
  Check,
  CircleCheck,
  FolderInput,
  Loader2,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  CollaboratorAvatars,
  type CollaboratorLike,
} from "@/components/cloud/collaborator-avatars";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileArtwork,
  FolderArtwork,
  getDocumentLabel,
} from "@/lib/client/file-icons";
import { folderDropId, itemDragId, type SidebarDragItem } from "@/lib/client/sidebar-dnd";
import {
  cloudItemPreviewSource,
  FileTypePreview,
  ItemPreviewBody,
  ItemPreviewPane,
} from "@/components/cloud/item-previews";
import { cn, formatBytes } from "@/lib/core/utils";

export type CloudItem =
  | { kind: "folder"; id: string; title: string; color: string; count: number }
  | { kind: "page"; id: string; title: string; pinned?: boolean }
  | {
      kind: "document";
      id: string;
      title: string;
      type: string;
      sizeBytes?: number | null;
      pending?: boolean;
      processing?: boolean;
      pinned?: boolean;
      /** Indexing/embedding status: PROCESSING | READY | FAILED. */
      status?: string;
    };

/** Per-item selection wiring passed down to a card or row. */
export type SelectionState = {
  selectable: boolean;
  selected: boolean;
  /** True when at least one item is selected (forces the checkbox to show). */
  active: boolean;
  onToggle: (shiftKey: boolean) => void;
};

type ItemActions = {
  href: string;
  /** When set, clicking opens an in-app preview panel instead of navigating. */
  onOpen?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onMove?: () => void;
  onReindex?: () => void;
  onTogglePin?: () => void;
};

/** True when the item supports a personal pin (pages + documents). */
function itemPinned(item: CloudItem): boolean {
  return (item.kind === "page" || item.kind === "document") && Boolean(item.pinned);
}

/**
 * Single click opens the item in the preview sidebar; double click navigates to
 * the full-page view. A short timer disambiguates the two so a single click
 * doesn't also fire on the way to a double click.
 */
function useOpenInteraction(href: string, onOpen?: () => void) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      router.push(href);
      return;
    }
    timer.current = setTimeout(() => {
      timer.current = null;
      onOpen?.();
    }, 220);
  }, [href, onOpen, router]);
}

/** Small checkbox used for multi-select on cards and rows. */
function SelectBox({
  checked,
  onToggle,
  className,
}: {
  checked: boolean;
  onToggle: (shiftKey: boolean) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={checked ? "Deselect" : "Select"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle(e.shiftKey);
      }}
      className={cn(
        "flex size-4 items-center justify-center rounded-[5px] border transition-colors",
        checked
          ? "border-primary bg-primary text-primary-foreground"
          : "border-muted-foreground/40 bg-background/80 hover:border-muted-foreground",
        className
      )}
    >
      {checked && <Check className="size-3" strokeWidth={3} />}
    </button>
  );
}

/** A page or document can be dragged into a folder; folders are drop targets only. */
function toDragItem(item: CloudItem): SidebarDragItem | null {
  if (item.kind === "page") return { type: "page", id: item.id, title: item.title };
  if (item.kind === "document")
    return { type: "document", id: item.id, title: item.title, docType: item.type };
  return null;
}

function itemLabel(item: CloudItem) {
  if (item.kind === "folder") return `${item.count} item${item.count === 1 ? "" : "s"}`;
  if (item.kind === "page") return "Page";
  if (item.pending) return "Uploading…";
  if (item.processing) return "Processing…";
  return getDocumentLabel(item.type);
}

/** Wraps a tile/row so a page or document can be picked up and dragged. */
function DraggableWrapper({
  item,
  className,
  children,
}: {
  item: SidebarDragItem;
  className?: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: itemDragId(item),
    data: item,
  });
  return (
    <div
      ref={setNodeRef}
      className={cn(className, isDragging && "opacity-40")}
      {...listeners}
      {...attributes}
    >
      {children}
    </div>
  );
}

/** Wraps a folder tile/row so items can be dropped onto it. */
function DroppableWrapper({
  folderId,
  className,
  children,
}: {
  folderId: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: folderDropId(folderId),
    data: { folderId },
  });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        className,
        "transition-colors",
        isOver && "bg-primary/10 ring-2 ring-inset ring-primary/40"
      )}
    >
      {children}
    </div>
  );
}

/** Adds drag-to-move behavior around a tile/row when enabled. */
function DndShell({
  item,
  enableDnd,
  className,
  children,
}: {
  item: CloudItem;
  enableDnd?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  if (!enableDnd) return <>{children}</>;
  if (item.kind === "folder") {
    return (
      <DroppableWrapper folderId={item.id} className={className}>
        {children}
      </DroppableWrapper>
    );
  }
  const drag = toDragItem(item);
  if (!drag) return <>{children}</>;
  return (
    <DraggableWrapper item={drag} className={className}>
      {children}
    </DraggableWrapper>
  );
}

function ActionMenu({
  pinned,
  onTogglePin,
  onEdit,
  onDelete,
  onMove,
  onReindex,
  className,
}: {
  pinned?: boolean;
  onTogglePin?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onMove?: () => void;
  onReindex?: () => void;
  className?: string;
}) {
  if (!onTogglePin && !onEdit && !onDelete && !onMove && !onReindex) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn("shrink-0 text-muted-foreground", className)}
            aria-label="More actions"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          />
        }
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {onTogglePin && (
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin();
            }}
          >
            {pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
            {pinned ? "Unpin" : "Pin"}
          </DropdownMenuItem>
        )}
        {onEdit && (
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Pencil className="size-3.5" />
            Rename
          </DropdownMenuItem>
        )}
        {onMove && (
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onMove();
            }}
          >
            <FolderInput className="size-3.5" />
            Move to…
          </DropdownMenuItem>
        )}
        {onReindex && (
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onReindex();
            }}
          >
            <RefreshCw className="size-3.5" />
            Reindex
          </DropdownMenuItem>
        )}
        {onDelete && (
          <DropdownMenuItem
            variant="destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="size-3.5" />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Large illustrative artwork for grid tiles. */
function EntityArtwork({ item, className }: { item: CloudItem; className?: string }) {
  if (item.kind === "folder") {
    return <FolderArtwork color={item.color} className={className} />;
  }
  const type = item.kind === "page" ? "PAGE" : item.type;
  return <FileArtwork type={type} className={className} />;
}

/** Short type · size descriptor shown under a card title. */
function cardMeta(item: CloudItem): string {
  if (item.kind === "folder") return `${item.count} item${item.count === 1 ? "" : "s"}`;
  if (item.kind === "page") return "Page";
  if (item.pending) return "Uploading…";
  if (item.processing) return "Processing…";
  const size = formatBytes(item.sizeBytes);
  return size ? `${getDocumentLabel(item.type)} · ${size}` : getDocumentLabel(item.type);
}

/** Resolves a document's effective indexing status for display. */
function docStatus(item: CloudItem): "PROCESSING" | "READY" | "FAILED" | null {
  if (item.kind !== "document" || item.pending) return null;
  if (item.processing) return "PROCESSING";
  if (item.status === "FAILED") return "FAILED";
  if (item.status === "PROCESSING") return "PROCESSING";
  // Treat missing status as indexed (older docs / optimistic moves).
  return "READY";
}

/** Compact "is this searchable?" indicator shown on document cards and rows. */
function IndexStatusBadge({ item, className }: { item: CloudItem; className?: string }) {
  const status = docStatus(item);
  if (!status) return null;

  if (status === "PROCESSING") {
    return (
      <span className={cn("inline-flex items-center gap-1 text-muted-foreground", className)}>
        <Loader2 className="size-3 animate-spin" />
        Indexing…
      </span>
    );
  }
  if (status === "FAILED") {
    return (
      <span className={cn("inline-flex items-center gap-1 text-destructive", className)}>
        <AlertCircle className="size-3" />
        Not indexed
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-500", className)}>
      <CircleCheck className="size-3" />
      Indexed
    </span>
  );
}

/** Small illustrative artwork glyph for a card footer (spinner overlay while busy). */
function renderTypeChip(type: string, busy?: boolean) {
  return (
    <span className="relative shrink-0">
      <FileArtwork type={type} className="size-8" />
      {busy && (
        <Loader2 className="absolute -bottom-1 -right-1 size-3.5 animate-spin rounded-full bg-background text-muted-foreground" />
      )}
    </span>
  );
}

/**
 * Top preview pane for a file/page card: page text, deck slide, board scene,
 * flowchart, database table, image/pdf embed, or file glyph fallback.
 */
function CardPreview({ item }: { item: CloudItem }) {
  const [imageOk, setImageOk] = useState(true);
  const ready = !(item.kind === "document" && (item.pending || item.processing));
  const isImage = item.kind === "document" && item.type === "IMAGE" && ready;
  const isPdf = item.kind === "document" && item.type === "PDF" && ready;
  const isRichDoc =
    item.kind === "document" &&
    ["DECK", "WHITEBOARD", "FLOWCHART", "DATABASE"].includes(item.type) &&
    ready;

  return (
    <ItemPreviewPane className="aspect-4/3 border-b border-border/60">
      {item.kind === "page" || isRichDoc ? (
        <ItemPreviewBody source={cloudItemPreviewSource(item)} />
      ) : isImage && imageOk ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/documents/${item.id}/raw`}
          alt=""
          loading="lazy"
          className="size-full object-cover"
          onError={() => setImageOk(false)}
        />
      ) : isPdf ? (
        <iframe
          src={`/api/documents/${item.id}/raw#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
          title={item.title}
          loading="lazy"
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none absolute inset-0 size-full border-0 bg-white"
        />
      ) : item.kind === "document" ? (
        <ItemPreviewBody source={cloudItemPreviewSource(item)} />
      ) : (
        <FileTypePreview type="OTHER" />
      )}
    </ItemPreviewPane>
  );
}

/** Drive-style preview card: a content thumbnail with a name + type/size footer. */
export function EntityCard({
  item,
  href,
  onOpen,
  onEdit,
  onDelete,
  onMove,
  onReindex,
  onTogglePin,
  enableDnd,
  selection,
  collaborators,
}: {
  item: CloudItem;
  enableDnd?: boolean;
  selection?: SelectionState;
  collaborators?: CollaboratorLike[];
} & ItemActions) {
  const pending = item.kind === "document" && item.pending;
  const processing = item.kind === "document" && item.processing && !pending;
  const busy = pending || processing;
  const pinned = itemPinned(item);
  const hasActions = !pending && (onTogglePin || onEdit || onDelete || onMove || onReindex);
  const handleOpen = useOpenInteraction(href, onOpen);
  const canSelect = Boolean(selection?.selectable);
  const isSelected = Boolean(selection?.selected);
  const showSelect = canSelect && (isSelected || selection?.active);
  const isFolder = item.kind === "folder";
  const chipType = item.kind === "page" ? "PAGE" : item.kind === "document" ? item.type : "OTHER";

  return (
    <DndShell item={item} enableDnd={enableDnd && !pending} className="rounded-xl">
      <div
        className={cn(
          "group/card relative select-none overflow-hidden rounded-xl border bg-card text-left transition-all",
          isSelected ? "border-primary ring-2 ring-primary/40" : "border-border/60",
          pending
            ? "opacity-60"
            : "hover:border-border has-[a:focus-visible]:border-primary has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-primary/40 has-[button:focus-visible]:border-primary has-[button:focus-visible]:ring-2 has-[button:focus-visible]:ring-primary/40"
        )}
      >
        {canSelect && selection && (
          <div
            className={cn(
              "absolute left-2 top-2 z-10 transition-opacity",
              showSelect ? "opacity-100" : "opacity-0 group-hover/card:opacity-100"
            )}
          >
            <SelectBox checked={isSelected} onToggle={selection.onToggle} />
          </div>
        )}

        {!pending &&
          (onOpen ? (
            <button
              type="button"
              onClick={handleOpen}
              aria-label={item.title}
              title="Click to preview · double-click to open"
              className="absolute inset-0 z-0 outline-none"
            />
          ) : (
            <Link
              href={href}
              aria-label={item.title}
              className="absolute inset-0 z-0 outline-none"
            />
          ))}

        <div className={cn("pointer-events-none relative", pending && "animate-pulse")}>
          {!isFolder && <CardPreview item={item} />}
          <div className={cn("flex items-center gap-2.5", isFolder ? "px-3 py-3" : "px-2.5 py-2")}>
            {isFolder ? (
              <FolderArtwork color={item.color} className="size-9 shrink-0" />
            ) : (
              renderTypeChip(chipType, busy)
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium leading-tight text-foreground">
                {item.title}
              </span>
              <span className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <span className="truncate">{cardMeta(item)}</span>
                {item.kind === "document" && !item.pending && !item.processing && (
                  <>
                    <span className="text-border">·</span>
                    <IndexStatusBadge item={item} className="text-[11px]" />
                  </>
                )}
                {collaborators && collaborators.length > 0 && (
                  <CollaboratorAvatars people={collaborators} size="xs" className="ml-auto pl-1" />
                )}
              </span>
            </span>
          </div>
        </div>

        {pinned && (
          <span
            className="absolute right-1.5 top-1.5 z-0 flex size-6 items-center justify-center rounded-md bg-background/80 text-primary backdrop-blur transition-opacity group-hover/card:opacity-0"
            aria-hidden
          >
            <Pin className="size-3.5 fill-current" />
          </span>
        )}

        {hasActions && (
          <div className="absolute right-1.5 top-1.5 z-10 opacity-0 transition-opacity group-hover/card:opacity-100 group-focus-within/card:opacity-100">
            <ActionMenu
              pinned={pinned}
              onTogglePin={onTogglePin}
              onEdit={onEdit}
              onDelete={onDelete}
              onMove={onMove}
              onReindex={onReindex}
              className="bg-background/80 backdrop-blur"
            />
          </div>
        )}
      </div>
    </DndShell>
  );
}

/** Minimal list: a light header row over borderless rows with hover highlight. */
export type TableSelection = {
  active: boolean;
  isSelectable: (item: CloudItem) => boolean;
  isSelected: (item: CloudItem) => boolean;
  onToggle: (item: CloudItem, shiftKey: boolean) => void;
  allSelected: boolean;
  onToggleAll: () => void;
};

export function EntityTable({
  items,
  hrefFor,
  actionsFor,
  enableDnd,
  selection,
  collaborators,
}: {
  items: CloudItem[];
  hrefFor: (item: CloudItem) => string;
  actionsFor: (item: CloudItem) => {
    onOpen?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    onMove?: () => void;
    onReindex?: () => void;
    onTogglePin?: () => void;
  };
  enableDnd?: boolean;
  selection?: TableSelection;
  collaborators?: CollaboratorLike[];
}) {
  return (
    <div>
      <div className="flex items-center gap-3 border-b border-border px-2 pb-2 text-xs font-medium text-muted-foreground">
        {selection && (
          <span className="flex w-5 shrink-0 justify-center">
            <SelectBox checked={selection.allSelected} onToggle={selection.onToggleAll} />
          </span>
        )}
        <span className="w-7 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">Name</span>
        <span className="hidden w-20 shrink-0 text-right sm:inline">Size</span>
        <span className="hidden w-28 shrink-0 sm:inline">Type</span>
        <span className="hidden w-28 shrink-0 md:inline">Status</span>
        <span className="w-7 shrink-0" aria-hidden />
      </div>
      <div className="py-1">
        {items.map((item) => (
          <EntityRow
            key={`${item.kind}-${item.id}`}
            item={item}
            href={hrefFor(item)}
            enableDnd={enableDnd}
            collaborators={collaborators}
            selection={
              selection && {
                selectable: selection.isSelectable(item),
                selected: selection.isSelected(item),
                active: selection.active,
                onToggle: (shiftKey) => selection.onToggle(item, shiftKey),
              }
            }
            {...actionsFor(item)}
          />
        ))}
      </div>
    </div>
  );
}

function EntityRow({
  item,
  href,
  onOpen,
  onEdit,
  onDelete,
  onMove,
  onReindex,
  onTogglePin,
  enableDnd,
  selection,
  collaborators,
}: {
  item: CloudItem;
  enableDnd?: boolean;
  selection?: SelectionState;
  collaborators?: CollaboratorLike[];
} & ItemActions) {
  const pending = item.kind === "document" && item.pending;
  const processing = item.kind === "document" && item.processing && !pending;
  const busy = pending || processing;
  const pinned = itemPinned(item);
  const handleOpen = useOpenInteraction(href, onOpen);
  const canSelect = Boolean(selection?.selectable);
  const isSelected = Boolean(selection?.selected);
  const showSelect = canSelect && (isSelected || selection?.active);
  const sizeLabel = item.kind === "document" ? formatBytes(item.sizeBytes) : null;

  const inner = (
    <>
      <span className={cn("relative flex w-7 shrink-0 justify-center", pending && "animate-pulse")}>
        <EntityArtwork item={item} className="size-7" />
        {busy && (
          <Loader2
            className="absolute -bottom-1 -right-0.5 size-3 animate-spin rounded-full bg-background text-muted-foreground"
            aria-label={pending ? "Uploading" : "Processing"}
          />
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{item.title}</span>
      {pinned && <Pin className="size-3 shrink-0 fill-current text-primary" aria-hidden />}
      {collaborators && collaborators.length > 0 && (
        <CollaboratorAvatars people={collaborators} size="xs" className="hidden shrink-0 md:flex" />
      )}
      <span className="hidden w-20 shrink-0 truncate text-right text-xs text-muted-foreground sm:inline">
        {sizeLabel ?? ""}
      </span>
      <span className="hidden w-28 shrink-0 truncate text-xs text-muted-foreground sm:inline">
        {itemLabel(item)}
      </span>
      <span className="hidden w-28 shrink-0 truncate text-xs md:inline">
        {item.kind === "document" && !item.pending ? <IndexStatusBadge item={item} /> : null}
      </span>
    </>
  );

  const base =
    "group/row flex select-none items-center gap-3 rounded-md px-2 py-1 transition-colors";

  const selectCell =
    canSelect && selection ? (
      <span
        className={cn(
          "flex w-5 shrink-0 justify-center transition-opacity",
          showSelect ? "opacity-100" : "opacity-0 group-hover/row:opacity-100"
        )}
      >
        <SelectBox checked={isSelected} onToggle={selection.onToggle} />
      </span>
    ) : null;

  if (pending) {
    return (
      <div className={cn(base, "opacity-60")} aria-disabled>
        {selectCell}
        {inner}
        <span className="w-7 shrink-0" aria-hidden />
      </div>
    );
  }

  return (
    <DndShell item={item} enableDnd={enableDnd} className="rounded-md">
      <div className={cn(base, isSelected ? "bg-primary/5" : "hover:bg-muted/60")}>
        {selectCell}
        {onOpen ? (
          <button
            type="button"
            onClick={handleOpen}
            title="Click to preview · double-click to open"
            className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none"
          >
            {inner}
          </button>
        ) : (
          <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 outline-none">
            {inner}
          </Link>
        )}
        <div className="w-7 shrink-0 opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100">
          <ActionMenu
            pinned={pinned}
            onTogglePin={onTogglePin}
            onEdit={onEdit}
            onDelete={onDelete}
            onMove={onMove}
            onReindex={onReindex}
          />
        </div>
      </div>
    </DndShell>
  );
}
