"use client";

import { useCallback, useEffect, useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ViewScroll } from "@/components/ui/view";
import { ConfirmModal } from "@/components/modals/confirm-modal";
import { FileArtwork, FolderArtwork, getDocumentLabel } from "@/lib/client/file-icons";
import { cn, formatRelativeTime } from "@/lib/core/utils";
import { apiDelete, apiGet, apiPost } from "@/lib/client/api";

type TrashItem = {
  id: string;
  type: "page" | "document" | "folder";
  title: string;
  deletedAt: string;
  documentType?: string;
};

function itemLabel(item: TrashItem): string {
  if (item.type === "folder") return "Folder";
  if (item.type === "page") return "Page";
  return getDocumentLabel(item.documentType ?? "OTHER");
}

export function TrashView({ libraryId }: { libraryId: string }) {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<TrashItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ items: TrashItem[] }>(
        `/api/trash?libraryId=${encodeURIComponent(libraryId)}`
      );
      setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [libraryId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function restore(item: TrashItem) {
    await apiPost("/api/trash", { type: item.type, id: item.id, libraryId });
    await load();
  }

  async function confirmPermanentDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await apiDelete(
        `/api/trash?type=${pendingDelete.type}&id=${pendingDelete.id}&libraryId=${encodeURIComponent(libraryId)}`
      );
      setPendingDelete(null);
      await load();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-border px-6 py-8 md:px-10">
        <div className="mx-auto max-w-2xl">
          <h1 className="mb-1 text-2xl font-semibold tracking-tight">Trash</h1>
          <p className="text-sm text-muted-foreground">
            Restore items or delete them for good. Anything here is removed permanently after 30 days.
          </p>
        </div>
      </div>

      <ViewScroll className="px-6 py-6 md:px-10">
        <div className="mx-auto max-w-2xl">
          {loading ? (
            <div className="space-y-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-2 py-2">
                  <div className="size-7 shrink-0 animate-pulse rounded-md bg-muted" />
                  <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
              <Trash2 className="size-7 text-muted-foreground/70" />
              <p className="mt-4 text-sm font-medium text-foreground">Trash is empty</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Deleted pages, files, and folders show up here so you can restore them.
              </p>
            </div>
          ) : (
            <div className="py-1">
              {items.map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className="group/row flex select-none items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/60"
                >
                  <span className="flex w-7 shrink-0 justify-center">
                    {item.type === "folder" ? (
                      <FolderArtwork color="yellow" className="size-7" />
                    ) : (
                      <FileArtwork
                        type={item.type === "page" ? "page" : item.documentType ?? "document"}
                        className="size-7"
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {item.title}
                  </span>
                  <span className="hidden w-28 shrink-0 truncate text-xs text-muted-foreground sm:inline">
                    {itemLabel(item)}
                  </span>
                  <span className="hidden w-24 shrink-0 truncate text-xs text-muted-foreground md:inline">
                    {formatRelativeTime(item.deletedAt)}
                  </span>
                  <div
                    className={cn(
                      "flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity",
                      "group-hover/row:opacity-100 group-focus-within/row:opacity-100"
                    )}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => restore(item)}
                    >
                      <RotateCcw className="size-3.5" />
                      Restore
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                      title="Delete permanently"
                      aria-label="Delete permanently"
                      onClick={() => setPendingDelete(item)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ViewScroll>

      <ConfirmModal
        open={pendingDelete !== null}
        title="Delete permanently?"
        description={
          pendingDelete
            ? `"${pendingDelete.title}" will be permanently deleted. This can't be undone.`
            : ""
        }
        confirmLabel="Delete permanently"
        loading={deleting}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        onConfirm={confirmPermanentDelete}
      />
    </div>
  );
}
