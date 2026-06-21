"use client";

import { useMemo, useState } from "react";
import { Check, Library as LibraryIcon, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FolderIcon } from "@/components/icons/folder-icon";
import type { FolderItem } from "@/lib/library/folders";
import { cn } from "@/lib/core/utils";

type FlatFolder = { id: string; name: string; color: string; parentId: string | null };

type FolderOption = FlatFolder & { depth: number };

type Props = {
  open: boolean;
  item: FolderItem | null;
  folders: FlatFolder[];
  currentFolderId: string | null;
  libraryName: string;
  onOpenChange: (open: boolean) => void;
  onMove: (folderId: string | null) => void | Promise<void>;
};

/** Flattens the folder list into a depth-ordered tree for an indented picker. */
function buildFolderOptions(folders: FlatFolder[]): FolderOption[] {
  const byParent = new Map<string | null, FlatFolder[]>();
  for (const folder of folders) {
    const key = folder.parentId ?? null;
    const list = byParent.get(key) ?? [];
    list.push(folder);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }

  const out: FolderOption[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const folder of byParent.get(parentId) ?? []) {
      out.push({ ...folder, depth });
      walk(folder.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

export function MoveModal({
  open,
  item,
  folders,
  currentFolderId,
  libraryName,
  onOpenChange,
  onMove,
}: Props) {
  const [pendingTarget, setPendingTarget] = useState<string | null | undefined>(undefined);
  const options = useMemo(() => buildFolderOptions(folders), [folders]);

  async function handleSelect(folderId: string | null) {
    if (folderId === currentFolderId || pendingTarget !== undefined) return;
    setPendingTarget(folderId);
    try {
      await onMove(folderId);
    } finally {
      setPendingTarget(undefined);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pendingTarget !== undefined) return;
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move {item?.title ? `"${item.title}"` : "item"}</DialogTitle>
          <DialogDescription>Choose a destination folder.</DialogDescription>
        </DialogHeader>
        <div className="-mx-2 max-h-80 overflow-y-auto px-2 py-1">
          <DestinationRow
            label={libraryName}
            icon={<LibraryIcon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />}
            depth={0}
            isCurrent={currentFolderId === null}
            isPending={pendingTarget === null}
            disabled={pendingTarget !== undefined}
            onSelect={() => void handleSelect(null)}
          />
          {options.map((folder) => (
            <DestinationRow
              key={folder.id}
              label={folder.name}
              icon={<FolderIcon color={folder.color} className="size-4 shrink-0" />}
              depth={folder.depth + 1}
              isCurrent={currentFolderId === folder.id}
              isPending={pendingTarget === folder.id}
              disabled={pendingTarget !== undefined}
              onSelect={() => void handleSelect(folder.id)}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DestinationRow({
  label,
  icon,
  depth,
  isCurrent,
  isPending,
  disabled,
  onSelect,
}: {
  label: string;
  icon: React.ReactNode;
  depth: number;
  isCurrent: boolean;
  isPending: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled || isCurrent}
      onClick={onSelect}
      style={{ paddingLeft: depth * 16 + 8 }}
      className={cn(
        "flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-left text-sm transition-colors",
        isCurrent ? "text-muted-foreground" : "hover:bg-muted/60",
        disabled && !isPending && "cursor-default opacity-60"
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {isPending && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />}
      {isCurrent && !isPending && (
        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          <Check className="size-3.5" />
          Current
        </span>
      )}
    </button>
  );
}
