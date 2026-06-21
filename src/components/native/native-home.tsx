"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownAZ, ArrowUpZA, ChevronDown, Pin, Search } from "lucide-react";
import { CollaboratorAvatars } from "@/components/cloud/collaborator-avatars";
import { pinTargetForItem, setPin } from "@/lib/client/pins";
import { NativeAppShell } from "@/components/native/native-app-shell";
import { NativeTopBar } from "@/components/native/native-top-bar";
import type { Library } from "@/components/sidebar/library-switcher";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ItemThumbnail,
  recentItemPreviewSource,
} from "@/components/cloud/item-previews";
import { FileArtwork } from "@/lib/client/file-icons";
import { apiGet } from "@/lib/client/api";
import { NATIVE_TYPES, type NativeKind } from "@/lib/native/native-types";
import type { RecentItem } from "@/lib/native/recents";
import { nativeEditorRoute } from "@/lib/client/routes";
import { cn, formatRelativeTime, formatShortDate } from "@/lib/core/utils";

type SortMode = "recent" | "name-asc" | "name-desc";

type OwnerFilter = "all" | "mine" | "shared";

const OWNER_LABELS: Record<OwnerFilter, string> = {
  all: "All",
  mine: "Mine",
  shared: "Shared",
};

const SORT_LABELS: Record<SortMode, string> = {
  recent: "Recent",
  "name-asc": "Name (A–Z)",
  "name-desc": "Name (Z–A)",
};

export function NativeHome({ kind }: { kind: NativeKind }) {
  return (
    <NativeAppShell
      kind={kind}
      topBar={(shell) => (
        <NativeTopBar
          mode="home"
          kind={kind}
          libraryId={shell.activeLibraryId}
          sidebarCollapsed={shell.sidebarCollapsed}
          onToggleSidebar={shell.toggleSidebar}
        />
      )}
    >
      {(shell) => (
        <NativeHomeMain
          kind={kind}
          activeLibraryId={shell.activeLibraryId}
          libraries={shell.libraries}
          librariesLoading={shell.librariesLoading}
        />
      )}
    </NativeAppShell>
  );
}

function NativeHomeMain({
  kind,
  activeLibraryId,
  libraries,
  librariesLoading,
}: {
  kind: NativeKind;
  activeLibraryId: string | null;
  libraries: Library[];
  librariesLoading: boolean;
}) {
  const cfg = NATIVE_TYPES[kind];

  const [items, setItems] = useState<RecentItem[] | null>(null);
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState<OwnerFilter>("all");
  const [sort, setSort] = useState<SortMode>("recent");

  const togglePin = useCallback((item: RecentItem) => {
    const next = !item.pinned;
    setItems((prev) =>
      prev
        ? prev.map((i) => (i.id === item.id ? { ...i, pinned: next } : i))
        : prev
    );
    void setPin(pinTargetForItem(item.type, item.id), next).catch(() => {
      setItems((prev) =>
        prev
          ? prev.map((i) => (i.id === item.id ? { ...i, pinned: !next } : i))
          : prev
      );
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setItems(null);
      try {
        const data = await apiGet<{ items: RecentItem[] }>(
          `/api/recents?kind=${kind}&limit=50`
        );
        if (!cancelled) setItems(data.items);
      } catch {
        if (!cancelled) setItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kind]);

  const trimmedQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!items) return [];
    let list = items;
    if (activeLibraryId) {
      list = list.filter((i) => i.libraryId === activeLibraryId);
    }
    if (owner !== "all") {
      list = list.filter((i) => (owner === "shared" ? i.shared : !i.shared));
    }
    if (trimmedQuery) {
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(trimmedQuery) ||
          i.libraryName.toLowerCase().includes(trimmedQuery) ||
          (i.preview?.toLowerCase().includes(trimmedQuery) ?? false)
      );
    }
    if (sort === "name-asc") {
      list = [...list].sort((a, b) =>
        (a.title || "Untitled").localeCompare(b.title || "Untitled")
      );
    } else if (sort === "name-desc") {
      list = [...list].sort((a, b) =>
        (b.title || "Untitled").localeCompare(a.title || "Untitled")
      );
    }
    return list;
  }, [items, trimmedQuery, activeLibraryId, owner, sort]);

  const hasActiveFilters =
    trimmedQuery.length > 0 || owner !== "all" || sort !== "recent";

  const pinnedItems = useMemo(() => filtered.filter((i) => i.pinned), [filtered]);
  const unpinned = useMemo(() => filtered.filter((i) => !i.pinned), [filtered]);

  // Only carve out a "Recent" grid when there are enough items to also fill the
  // list below; otherwise everything lives in the filterable "All …" list.
  const featured = !hasActiveFilters && unpinned.length > 4 ? unpinned.slice(0, 4) : [];
  const rest = unpinned.slice(featured.length);

  return (
    <main className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-6 py-8">
            {!librariesLoading && libraries.length === 0 && (
              <p className="mb-6 text-sm text-muted-foreground">
                Create a library to start adding {cfg.plural.toLowerCase()}.
              </p>
            )}

            {items === null ? (
              <RecentsSkeleton />
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No {cfg.plural.toLowerCase()} in this library yet — create blank or browse
                templates.
              </p>
            ) : (
          <div className="space-y-8">
            {pinnedItems.length > 0 && (
              <section>
                <h2 className="mb-4 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                  <Pin className="size-3.5" />
                  Pinned
                </h2>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {pinnedItems.map((item) => (
                    <li key={item.id}>
                      <RecentCard item={item} kind={kind} onTogglePin={togglePin} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {featured.length > 0 && (
              <section>
                <h2 className="mb-4 text-sm font-medium text-muted-foreground">Recent</h2>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {featured.map((item) => (
                    <li key={item.id}>
                      <RecentCard item={item} kind={kind} onTogglePin={togglePin} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-medium text-muted-foreground">
                  {hasActiveFilters ? "Results" : `All ${cfg.plural.toLowerCase()}`}
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-full sm:w-52 md:w-60">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={`Search ${cfg.plural.toLowerCase()}`}
                      className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                  </div>
                  <div className="flex h-8 items-center rounded-md border border-border bg-background p-0.5">
                    {(["all", "mine", "shared"] as OwnerFilter[]).map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={owner === value}
                        onClick={() => setOwner(value)}
                        className={cn(
                          "rounded-[5px] px-2.5 text-xs font-medium transition-colors",
                          owner === value
                            ? "bg-muted text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {OWNER_LABELS[value]}
                      </button>
                    ))}
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 border-border bg-background"
                        />
                      }
                    >
                      {sort === "name-desc" ? (
                        <ArrowUpZA className="size-3.5" />
                      ) : (
                        <ArrowDownAZ className="size-3.5" />
                      )}
                      <span className="hidden sm:inline">{SORT_LABELS[sort]}</span>
                      <ChevronDown className="size-3.5 opacity-70" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuRadioGroup
                        value={sort}
                        onValueChange={(v) => setSort(v as SortMode)}
                      >
                        <DropdownMenuRadioItem value="recent">
                          {SORT_LABELS.recent}
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="name-asc">
                          {SORT_LABELS["name-asc"]}
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="name-desc">
                          {SORT_LABELS["name-desc"]}
                        </DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {rest.length > 0 ? (
                <ul className="overflow-hidden rounded-xl border border-border bg-card divide-y divide-border">
                  {rest.map((item) => (
                    <li key={item.id}>
                      <RecentRow item={item} kind={kind} onTogglePin={togglePin} />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center text-sm text-muted-foreground">
                  {trimmedQuery
                    ? `No ${cfg.plural.toLowerCase()} match “${query.trim()}”.`
                    : owner !== "all"
                      ? `No ${owner} ${cfg.plural.toLowerCase()} in this library.`
                      : `No more ${cfg.plural.toLowerCase()} in this library.`}
                </div>
              )}
            </section>
          </div>
            )}
      </div>
    </main>
  );
}

/** Pin/unpin toggle shown on recent cards and rows. */
function PinButton({
  item,
  onTogglePin,
  className,
}: {
  item: RecentItem;
  onTogglePin: (item: RecentItem) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={item.pinned ? "Unpin" : "Pin"}
      title={item.pinned ? "Unpin" : "Pin"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onTogglePin(item);
      }}
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-md border transition-colors",
        item.pinned
          ? "border-primary/40 text-primary"
          : "border-transparent text-muted-foreground opacity-0 hover:border-border hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100",
        className
      )}
    >
      <Pin className={cn("size-3.5", item.pinned && "fill-current")} />
    </button>
  );
}

/** Featured preview card (used for pinned + most-recent items). */
function RecentCard({
  item,
  kind,
  onTogglePin,
}: {
  item: RecentItem;
  kind: NativeKind;
  onTogglePin: (item: RecentItem) => void;
}) {
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-foreground/30">
      <Link href={nativeEditorRoute(kind, item.id)} className="flex flex-col">
        <RecentThumbnail item={item} />
        <span className="flex flex-col gap-1 border-t border-border bg-card px-3 py-2.5">
          <span className="truncate text-sm font-medium" title={item.title}>
            {item.title || "Untitled"}
          </span>
          <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            <span className="truncate">
              {formatShortDate(item.createdAt)} · {item.libraryName}
            </span>
            <span aria-hidden>·</span>
            <span className="shrink-0">{formatRelativeTime(item.updatedAt)}</span>
            {item.collaborators.length > 0 && (
              <CollaboratorAvatars people={item.collaborators} size="xs" className="ml-auto" />
            )}
          </span>
        </span>
      </Link>
      <PinButton
        item={item}
        onTogglePin={onTogglePin}
        className="absolute right-2 top-2 z-10 bg-background/90 backdrop-blur"
      />
    </div>
  );
}

/** Compact list row for the remaining (older / searched) items. */
function RecentRow({
  item,
  kind,
  onTogglePin,
}: {
  item: RecentItem;
  kind: NativeKind;
  onTogglePin: (item: RecentItem) => void;
}) {
  return (
    <div className="group/row flex items-center gap-3 bg-card px-3 py-2.5 transition-colors hover:bg-muted/40">
      <Link
        href={nativeEditorRoute(kind, item.id)}
        className="flex min-w-0 flex-1 items-center gap-3 outline-none"
      >
        <span className="flex w-6 shrink-0 justify-center">
          <FileArtwork type={item.type} className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground" title={item.title}>
            {item.title || "Untitled"}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {formatShortDate(item.createdAt)} · {item.libraryName}
          </span>
        </span>
      </Link>
      {item.collaborators.length > 0 && (
        <CollaboratorAvatars people={item.collaborators} size="xs" className="hidden shrink-0 sm:flex" />
      )}
      <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
        {formatRelativeTime(item.updatedAt)}
      </span>
      <PinButton
        item={item}
        onTogglePin={onTogglePin}
        className={cn(
          "opacity-100 sm:opacity-0 sm:group-hover/row:opacity-100 sm:focus-visible:opacity-100",
          item.pinned && "opacity-100"
        )}
      />
    </div>
  );
}

function RecentThumbnail({ item }: { item: RecentItem }) {
  return (
    <ItemThumbnail
      source={recentItemPreviewSource(item)}
      className="aspect-4/3 w-full bg-white dark:bg-card"
    />
  );
}

function RecentsSkeleton() {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <li
          key={i}
          className="overflow-hidden rounded-xl border border-border bg-card"
        >
          <div className="aspect-4/3 animate-pulse bg-muted/50" />
          <div className="space-y-2 border-t border-border px-3 py-2.5">
            <div className="h-3.5 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        </li>
      ))}
    </ul>
  );
}
