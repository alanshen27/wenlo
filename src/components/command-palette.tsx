"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Search, Settings, Sparkles, Trash2, Upload, type LucideIcon } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FileArtwork } from "@/lib/client/file-icons";
import {
  libraryHome,
  nativeHomeRoute,
  pageRoute,
  documentOpenRoute,
  recallRoute,
  searchRoute,
  settingsRoute,
  trashRoute,
} from "@/lib/client/routes";
import { apiGet, apiPost } from "@/lib/client/api";
import type { NativeKind } from "@/lib/native/native-types";

type RecentItem = {
  id: string;
  title: string;
  kind: "page" | "document";
  documentType?: string;
  libraryId: string;
};

type SearchHit = {
  id: string;
  sourceType: "page" | "document";
  title: string;
  snippet: string;
};

type PaletteAction = {
  label: string;
  href: string;
  /** Document/native type rendered with colorful FileArtwork. */
  artwork?: string;
  /** Lucide glyph for non-file navigation actions. */
  icon?: LucideIcon;
};

type Props = {
  libraryId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CommandPalette({ libraryId, open, onOpenChange }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<RecentItem[]>([]);
  const [results, setResults] = useState<SearchHit[]>([]);

  useEffect(() => {
    if (!open) return;
    void apiGet<{ items?: RecentItem[] }>("/api/command-palette/recents")
      .then((d) => setRecents(d.items ?? []))
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!query.trim() || !libraryId) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      void apiPost<{ results?: SearchHit[] }>("/api/recall", {
        query,
        libraryId,
        limit: 8,
      })
        .then((d) => setResults(d.results ?? []))
        .catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(t);
  }, [query, libraryId]);

  function go(path: string) {
    onOpenChange(false);
    setQuery("");
    router.push(path);
  }

  const actions: PaletteAction[] = [
    { label: "New page", artwork: "PAGE", href: nativeHomeRoute("pages" as NativeKind) },
    { label: "New deck", artwork: "DECK", href: nativeHomeRoute("decks" as NativeKind) },
    { label: "Upload file", icon: Upload, href: libraryId ? libraryHome(libraryId) : "/" },
    { label: "Open settings", icon: Settings, href: settingsRoute() },
    { label: "Search library", icon: Search, href: libraryId ? searchRoute(libraryId) : "/" },
    { label: "Recall chat", icon: Sparkles, href: libraryId ? recallRoute(libraryId) : "/" },
    { label: "Trash", icon: Trash2, href: libraryId ? trashRoute(libraryId) : "/" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-lg">
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted-foreground">
          <div className="flex items-center border-b border-border px-3">
            <Search className="mr-2 size-4 shrink-0 text-muted-foreground" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search or jump to…"
              className="flex h-11 w-full bg-transparent text-sm outline-none"
            />
          </div>
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results.
            </Command.Empty>

            {!query && recents.length > 0 && (
              <Command.Group heading="Recent">
                {recents.slice(0, 5).map((item) => (
                  <Command.Item
                    key={item.id}
                    value={item.title}
                    onSelect={() =>
                      go(
                        item.kind === "page"
                          ? pageRoute(item.libraryId, item.id)
                          : documentOpenRoute(item.libraryId, item.id, item.documentType)
                      )
                    }
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm aria-selected:bg-muted"
                  >
                    <FileArtwork
                      type={item.kind === "page" ? "PAGE" : (item.documentType ?? "OTHER")}
                      className="size-5"
                    />
                    <span className="truncate">{item.title}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {results.length > 0 && (
              <Command.Group heading="Search">
                {results.map((r) => (
                  <Command.Item
                    key={r.id}
                    value={r.title}
                    onSelect={() =>
                      go(
                        r.sourceType === "page"
                          ? pageRoute(libraryId!, r.id)
                          : documentOpenRoute(libraryId!, r.id)
                      )
                    }
                    className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-sm aria-selected:bg-muted"
                  >
                    <FileArtwork
                      type={r.sourceType === "page" ? "PAGE" : "OTHER"}
                      className="mt-0.5 size-5 shrink-0"
                    />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate font-medium">{r.title}</span>
                      <span className="truncate text-xs text-muted-foreground">{r.snippet}</span>
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {!query && (
              <Command.Group heading="Actions">
                {actions.map((a) => (
                  <Command.Item
                    key={a.label}
                    value={a.label}
                    onSelect={() => go(a.href)}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm aria-selected:bg-muted"
                  >
                    {a.artwork ? (
                      <FileArtwork type={a.artwork} className="size-5" />
                    ) : a.icon ? (
                      <span className="flex size-5 items-center justify-center">
                        <a.icon className="size-4 text-muted-foreground" />
                      </span>
                    ) : null}
                    {a.label}
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return { open, setOpen };
}
