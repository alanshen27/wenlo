"use client";

import Link from "next/link";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { FolderInput, Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
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
import { cn } from "@/lib/utils";

export type CloudItem =
  | { kind: "folder"; id: string; title: string; color: string; count: number }
  | { kind: "page"; id: string; title: string }
  | {
      kind: "document";
      id: string;
      title: string;
      type: string;
      pending?: boolean;
      processing?: boolean;
    };

type ItemActions = {
  href: string;
  onEdit?: () => void;
  onDelete?: () => void;
  onMove?: () => void;
};

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
  onEdit,
  onDelete,
  onMove,
  enableDnd,
}: { item: CloudItem; enableDnd?: boolean } & ItemActions) {
  const pending = item.kind === "document" && item.pending;
  const processing = item.kind === "document" && item.processing && !pending;
  const busy = pending || processing;
  const hasActions = !pending && (onEdit || onDelete || onMove);

  return (
    <DndShell item={item} enableDnd={enableDnd && !pending} className="rounded-2xl">
      <div
        className={cn(
          "group/card relative flex flex-col items-center gap-3 rounded-2xl border border-border/60 bg-card px-3 py-5 text-center shadow-sm transition-all",
          pending
            ? "opacity-60"
            : "hover:-translate-y-0.5 hover:border-border hover:shadow-md has-[a:focus-visible]:border-primary has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-primary/40"
        )}
      >
        {!pending && (
          <Link
            href={href}
            aria-label={item.title}
            className="absolute inset-0 z-0 rounded-2xl outline-none"
          />
        )}

        <span className={cn("relative", pending && "animate-pulse")}>
          <EntityArtwork item={item} className="size-16" />
          {busy && (
            <Loader2
              className="absolute -bottom-0.5 -right-0.5 size-4 animate-spin rounded-full bg-background text-muted-foreground"
              aria-label={pending ? "Uploading" : "Processing"}
            />
          )}
        </span>

        <p className="relative z-0 line-clamp-2 w-full px-1 text-[13px] font-medium leading-snug text-foreground wrap-break-word">
          {item.title}
        </p>

        {hasActions && (
          <div className="absolute right-1.5 top-1.5 z-10 opacity-0 transition-opacity group-hover/card:opacity-100 group-focus-within/card:opacity-100">
            <ActionMenu onEdit={onEdit} onDelete={onDelete} onMove={onMove} />
          </div>
        )}
      </div>
    </DndShell>
  );
}

/** Minimal list: a light header row over borderless rows with hover highlight. */
export function EntityTable({
  items,
  hrefFor,
  actionsFor,
  enableDnd,
}: {
  items: CloudItem[];
  hrefFor: (item: CloudItem) => string;
  actionsFor: (item: CloudItem) => { onEdit?: () => void; onDelete?: () => void; onMove?: () => void };
  enableDnd?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 border-b border-border px-2 pb-2 text-xs font-medium text-muted-foreground">
        <span className="w-7 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">Name</span>
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
  onEdit,
  onDelete,
  onMove,
  enableDnd,
}: { item: CloudItem; enableDnd?: boolean } & ItemActions) {
  const pending = item.kind === "document" && item.pending;
  const processing = item.kind === "document" && item.processing && !pending;
  const busy = pending || processing;

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
      <span className="hidden w-28 shrink-0 truncate text-xs text-muted-foreground sm:inline">
        {itemLabel(item)}
      </span>
    </>
  );

  const base = "group/row flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors";

  if (pending) {
    return (
      <div className={cn(base, "opacity-60")} aria-disabled>
        {inner}
        <span className="w-7 shrink-0" aria-hidden />
      </div>
    );
  }

  return (
    <DndShell item={item} enableDnd={enableDnd} className="rounded-md">
      <div className={cn(base, "hover:bg-muted/60")}>
        <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 outline-none">
          {inner}
        </Link>
        <div className="w-7 shrink-0 opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100">
          <ActionMenu onEdit={onEdit} onDelete={onDelete} onMove={onMove} />
        </div>
      </div>
    </DndShell>
  );
}
