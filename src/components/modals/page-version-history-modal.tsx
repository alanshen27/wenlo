"use client";

import { useCallback, useEffect, useState } from "react";
import { History, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiGet, apiPost, getApiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { PageVersionSummary } from "@/lib/page-versions";

type VersionDetail = PageVersionSummary & {
  content: unknown;
};

type Props = {
  open: boolean;
  pageId: string;
  canEdit: boolean;
  onOpenChange: (open: boolean) => void;
  onRestore: (page: {
    id: string;
    title: string;
    content: unknown;
    updatedAt: string;
  }) => void;
};

function formatWhen(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Today at ${time}`;
  return `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} at ${time}`;
}

function previewText(plainText: string, max = 160) {
  const trimmed = plainText.trim().replace(/\s+/g, " ");
  if (!trimmed) return "Empty page";
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

export function PageVersionHistoryModal({
  open,
  pageId,
  canEdit,
  onOpenChange,
  onRestore,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [versions, setVersions] = useState<PageVersionSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<VersionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadVersions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<{ versions?: PageVersionSummary[] }>(`/api/pages/${pageId}/versions`);
      const list = data.versions ?? [];
      setVersions(list);
      setSelectedId(list[0]?.id ?? null);
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to load version history"));
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  useEffect(() => {
    if (open) void loadVersions();
  }, [open, loadVersions]);

  useEffect(() => {
    if (!open || !selectedId) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    void (async () => {
      try {
        const data = await apiGet<VersionDetail>(`/api/pages/${pageId}/versions/${selectedId}`);
        if (!cancelled) setDetail(data);
      } catch {
        if (!cancelled) setDetail(null);
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, pageId, selectedId]);

  async function handleRestore() {
    if (!selectedId || !canEdit) return;
    setRestoring(true);
    setError(null);
    try {
      const data = await apiPost<Parameters<typeof onRestore>[0]>(
        `/api/pages/${pageId}/versions/${selectedId}/restore`
      );
      onRestore(data);
      onOpenChange(false);
    } catch (err) {
      setError(getApiErrorMessage(err, "Restore failed"));
    } finally {
      setRestoring(false);
    }
  }

  const selected = versions.find((v) => v.id === selectedId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(85vh,720px)] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <History className="size-4" />
            Version history
          </DialogTitle>
          <DialogDescription>
            Snapshots are saved automatically about every hour while you edit. Up to 100 versions
            are kept; older ones are deleted.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p className="px-6 py-2 text-sm text-destructive">{error}</p>
        )}

        {loading ? (
          <div className="flex flex-1 items-center justify-center py-16 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Loading versions…
          </div>
        ) : versions.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-muted-foreground">
            No versions yet. Edit the page to create the first snapshot.
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(220px,280px)_1fr]">
            <ScrollArea className="border-b border-border md:border-b-0 md:border-r">
              <ul className="p-2">
                {versions.map((version) => (
                  <li key={version.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(version.id)}
                      className={cn(
                        "w-full rounded-md px-3 py-2.5 text-left transition-colors",
                        selectedId === version.id
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-muted/60"
                      )}
                    >
                      <p className="truncate text-sm font-medium">{version.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatWhen(version.createdAt)}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {version.createdByName ?? "Unknown"}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </ScrollArea>

            <div className="flex min-h-0 flex-col">
              <ScrollArea className="flex-1 px-6 py-4">
                {detailLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading preview…
                  </div>
                ) : selected ? (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold">{selected.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatWhen(selected.createdAt)} · {selected.createdByName ?? "Unknown"}
                      </p>
                    </div>
                    <div className="rounded-md border border-border bg-muted/30 p-4">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                        {previewText(detail?.plainText ?? selected.plainText, 2000)}
                      </p>
                    </div>
                  </div>
                ) : null}
              </ScrollArea>

              {canEdit && selected && (
                <div className="border-t border-border px-6 py-4">
                  <Button
                    onClick={() => void handleRestore()}
                    disabled={restoring}
                    className="gap-2"
                  >
                    {restoring ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <RotateCcw className="size-4" />
                    )}
                    Restore this version
                  </Button>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Restores title and content for everyone in this workspace. A snapshot of the
                    current page is saved first.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function PageVersionHistoryButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="mb-2 h-8 gap-1.5 text-muted-foreground"
    >
      <History className="size-3.5" />
      History
    </Button>
  );
}
