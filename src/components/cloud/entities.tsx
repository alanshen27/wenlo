"use client";

import { useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Check, FolderInput, Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
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
} from "@/lib/file-icons";
import { folderDropId, itemDragId, type SidebarDragItem } from "@/lib/sidebar-dnd";
import { cn, formatBytes } from "@/lib/utils";

export type CloudItem =
  | { kind: "folder"; id: string; title: string; color: string; count: number }
  | { kind: "page"; id: string; title: string }
  | {
      kind: "document";
      id: string;
      title: string;
      type: string;
      sizeBytes?: number | null;
      pending?: boolean;
      processing?: boolean;
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
};

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
  onEdit,
  onDelete,
  onMove,
  className,
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  onMove?: () => void;
  className?: string;
}) {
  if (!onEdit && !onDelete && !onMove) return null;
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

/** Soft card (Dropbox / OneDrive style): big file artwork with the name beneath. */
export function EntityCard({
  item,
  href,
  onOpen,
  onEdit,
  onDelete,
  onMove,
  enableDnd,
  selection,
}: { item: CloudItem; enableDnd?: boolean; selection?: SelectionState } & ItemActions) {
  const pending = item.kind === "document" && item.pending;
  const processing = item.kind === "document" && item.processing && !pending;
  const busy = pending || processing;
  const hasActions = !pending && (onEdit || onDelete || onMove);
  const handleOpen = useOpenInteraction(href, onOpen);
  const canSelect = Boolean(selection?.selectable);
  const isSelected = Boolean(selection?.selected);
  const showSelect = canSelect && (isSelected || selection?.active);

  return (
    <DndShell item={item} enableDnd={enableDnd && !pending} className="rounded-xl">
      <div
        className={cn(
          "group/card relative flex select-none flex-col items-center gap-1.5 rounded-xl border bg-card px-1.5 py-2.5 text-center shadow-sm transition-all",
          isSelected ? "border-primary ring-2 ring-primary/40" : "border-border/60",
          pending
            ? "opacity-60"
            : "hover:-translate-y-0.5 hover:border-border hover:shadow-md has-[a:focus-visible]:border-primary has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-primary/40 has-[button:focus-visible]:border-primary has-[button:focus-visible]:ring-2 has-[button:focus-visible]:ring-primary/40"
        )}
      >
        {canSelect && selection && (
          <div
            className={cn(
              "absolute left-1.5 top-1.5 z-10 transition-opacity",
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
              className="absolute inset-0 z-0 rounded-xl outline-none"
            />
          ) : (
            <Link
              href={href}
              aria-label={item.title}
              className="absolute inset-0 z-0 rounded-xl outline-none"
            />
          ))}

        <span className={cn("pointer-events-none relative", pending && "animate-pulse")}>
          <EntityArtwork item={item} className="size-11" />
          {busy && (
            <Loader2
              className="absolute -bottom-0.5 -right-0.5 size-3.5 animate-spin rounded-full bg-background text-muted-foreground"
              aria-label={pending ? "Uploading" : "Processing"}
            />
          )}
        </span>

        <p className="pointer-events-none relative z-0 w-full truncate px-0.5 text-xs font-medium leading-tight text-foreground">
          {item.title}
        </p>

        {hasActions && (
          <div className="absolute right-1 top-1 z-10 opacity-0 transition-opacity group-hover/card:opacity-100 group-focus-within/card:opacity-100">
            <ActionMenu onEdit={onEdit} onDelete={onDelete} onMove={onMove} />
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
}: {
  items: CloudItem[];
  hrefFor: (item: CloudItem) => string;
  actionsFor: (item: CloudItem) => {
    onOpen?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    onMove?: () => void;
  };
  enableDnd?: boolean;
  selection?: TableSelection;
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
        <span className="w-7 shrink-0" aria-hidden />
      </div>
      <div className="py-1">
        {items.map((item) => (
          <EntityRow
            key={`${item.kind}-${item.id}`}
            item={item}
            href={hrefFor(item)}
            enableDnd={enableDnd}
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
  enableDnd,
  selection,
}: { item: CloudItem; enableDnd?: boolean; selection?: SelectionState } & ItemActions) {
  const pending = item.kind === "document" && item.pending;
  const processing = item.kind === "document" && item.processing && !pending;
  const busy = pending || processing;
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
      <span className="hidden w-20 shrink-0 truncate text-right text-xs text-muted-foreground sm:inline">
        {sizeLabel ?? ""}
      </span>
      <span className="hidden w-28 shrink-0 truncate text-xs text-muted-foreground sm:inline">
        {itemLabel(item)}
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
          <ActionMenu onEdit={onEdit} onDelete={onDelete} onMove={onMove} />
        </div>
      </div>
    </DndShell>
  );
}
