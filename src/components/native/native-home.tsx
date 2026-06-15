"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownAZ, ArrowUpZA, ChevronDown, Loader2, Pin, Plus, Search } from "lucide-react";
import { LibraryIcon } from "@/components/icons/library-icon";
import { CollaboratorAvatars } from "@/components/cloud/collaborator-avatars";
import { pinTargetForItem, setPin } from "@/lib/client/pins";
import { AppLauncher } from "@/components/native/app-launcher";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { createBlankNative, createFromNativeTemplate } from "@/lib/native/create-from-template";
import { listNativeTemplates, type NativeTemplateEntry } from "@/lib/native/native-templates";
import { templateItemPreviewSource } from "@/lib/native/template-preview-source";
import { NATIVE_TYPES, type NativeKind } from "@/lib/native/native-types";
import type { RecentItem } from "@/lib/native/recents";
import {
  libraryHome,
  nativeEditorRoute,
  readStoredLibraryId,
} from "@/lib/client/routes";
import { cn, formatRelativeTime } from "@/lib/core/utils";

type Library = { id: string; name: string; icon: string; role?: string };

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
  const router = useRouter();
  const cfg = NATIVE_TYPES[kind];
  const templates = useMemo(() => listNativeTemplates(kind), [kind]);

  const [libraries, setLibraries] = useState<Library[] | null>(null);
  const [items, setItems] = useState<RecentItem[] | null>(null);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [libraryFilter, setLibraryFilter] = useState<string>("all");
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
      try {
        const data = await apiGet<Library[]>("/api/libraries");
        if (!cancelled) setLibraries(data);
      } catch {
        if (!cancelled) setLibraries([]);
      }
    })();
    return () => {
      cancelled = true;
    };
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

  const activeLibraryId = useMemo(() => {
    if (!libraries || libraries.length === 0) return null;
    const stored = readStoredLibraryId();
    if (stored && libraries.some((l) => l.id === stored)) return stored;
    return libraries[0].id;
  }, [libraries]);

  const trimmedQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!items) return [];
    let list = items;
    if (libraryFilter !== "all") {
      list = list.filter((i) => i.libraryId === libraryFilter);
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
  }, [items, trimmedQuery, libraryFilter, owner, sort]);

  const hasActiveFilters =
    trimmedQuery.length > 0 || libraryFilter !== "all" || owner !== "all" || sort !== "recent";

  const pinnedItems = useMemo(() => filtered.filter((i) => i.pinned), [filtered]);
  const unpinned = useMemo(() => filtered.filter((i) => !i.pinned), [filtered]);

  // Only carve out a "Recent" grid when there are enough items to also fill the
  // list below; otherwise everything lives in the filterable "All …" list.
  const featured = !hasActiveFilters && unpinned.length > 4 ? unpinned.slice(0, 4) : [];
  const rest = unpinned.slice(featured.length);

  const handleCreateBlank = useCallback(async () => {
    if (!cfg.creatable || !activeLibraryId || creatingId) return;
    setCreatingId("blank");
    try {
      const id = await createBlankNative(kind, activeLibraryId);
      router.push(nativeEditorRoute(kind, id));
    } catch {
      setCreatingId(null);
    }
  }, [activeLibraryId, cfg.creatable, creatingId, kind, router]);

  const handleCreateTemplate = useCallback(
    async (templateId: string) => {
      if (!activeLibraryId || creatingId) return;
      setCreatingId(templateId);
      try {
        const id = await createFromNativeTemplate(kind, templateId, activeLibraryId);
        router.push(nativeEditorRoute(kind, id));
      } catch {
        setCreatingId(null);
      }
    },
    [activeLibraryId, creatingId, kind, router]
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 flex h-12 items-center gap-4 border-b border-sidebar-border bg-sidebar px-4 text-sidebar-foreground">
        <Link
          href={activeLibraryId ? libraryHome(activeLibraryId) : "/"}
          className="flex shrink-0 items-center gap-2 rounded-md px-1 py-1 transition-opacity hover:opacity-80"
          title="Back to library"
        >
          <FileArtwork type={cfg.artworkType} className="size-6" />
          <span className="text-base font-semibold tracking-tight">
            {cfg.plural}
          </span>
        </Link>
        <div className="relative mx-auto w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${cfg.plural.toLowerCase()}`}
            className="h-9 w-full rounded-lg border border-sidebar-border bg-sidebar-accent/50 pl-9 pr-3 text-sm text-sidebar-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-sidebar-border focus:bg-sidebar-accent"
          />
        </div>
        <div className="flex shrink-0 items-center">
          <AppLauncher />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {cfg.creatable && (
          <section className="mb-10">
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">
              Create new
            </h2>
            <ul className="-mx-6 flex gap-3 overflow-x-auto px-6 pb-2 pt-1 scrollbar-none">
              <li className="w-60 shrink-0">
                <button
                  type="button"
                  onClick={handleCreateBlank}
                  disabled={!!creatingId || !activeLibraryId}
                  className="group flex w-full flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition-colors hover:border-foreground/30 disabled:pointer-events-none disabled:opacity-60"
                >
                  <span
                    className="flex aspect-4/3 items-center justify-center"
                    style={{ backgroundColor: `${cfg.accent}14` }}
                  >
                    {creatingId === "blank" ? (
                      <Loader2 className="size-7 animate-spin text-muted-foreground" />
                    ) : (
                      <span
                        className="flex size-11 items-center justify-center rounded-full text-white"
                        style={{ backgroundColor: cfg.accent }}
                      >
                        <Plus className="size-6" />
                      </span>
                    )}
                  </span>
                  <span className="border-t border-border px-3 py-2.5 text-sm font-medium">
                    {cfg.newLabel}
                  </span>
                </button>
              </li>
              {templates.map((template) => (
                <li key={template.id} className="w-60 shrink-0">
                  <TemplateCard
                    kind={kind}
                    template={template}
                    loading={creatingId === template.id}
                    disabled={!!creatingId || !activeLibraryId}
                    onClick={() => handleCreateTemplate(template.id)}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {items === null ? (
          <RecentsSkeleton />
        ) : items.length === 0 ? (
          <EmptyState kind={kind} canCreate={cfg.creatable} />
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
                      {libraryFilter === "all" ? (
                        <span className="text-muted-foreground">All libraries</span>
                      ) : (
                        <>
                          <LibraryIcon
                            icon={
                              libraries?.find((l) => l.id === libraryFilter)?.icon ?? ""
                            }
                            className="size-4"
                          />
                          <span className="max-w-32 truncate">
                            {libraries?.find((l) => l.id === libraryFilter)?.name ??
                              "Library"}
                          </span>
                        </>
                      )}
                      <ChevronDown className="size-3.5 opacity-70" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem onClick={() => setLibraryFilter("all")}>
                        All libraries
                      </DropdownMenuItem>
                      {(libraries ?? []).map((library) => (
                        <DropdownMenuItem
                          key={library.id}
                          onClick={() => setLibraryFilter(library.id)}
                        >
                          <LibraryIcon icon={library.icon} className="size-4" />
                          <span className="truncate">{library.name}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

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
                <ul className="overflow-hidden rounded-xl border border-border divide-y divide-border">
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
                    : libraryFilter !== "all"
                      ? `No ${cfg.plural.toLowerCase()} in this library.`
                      : owner !== "all"
                        ? `No ${owner} ${cfg.plural.toLowerCase()}.`
                        : `No more ${cfg.plural.toLowerCase()}.`}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function TemplateCard({
  kind,
  template,
  loading,
  disabled,
  onClick,
}: {
  kind: NativeKind;
  template: NativeTemplateEntry;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex w-full flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition-colors hover:border-foreground/30 disabled:pointer-events-none disabled:opacity-60"
    >
      {loading ? (
        <span className="flex aspect-4/3 items-center justify-center bg-muted/40">
          <Loader2 className="size-7 animate-spin text-muted-foreground" />
        </span>
      ) : (
        <TemplateThumbnail kind={kind} template={template} />
      )}
      <span className="border-t border-border px-3 py-2.5 text-sm font-medium">
        {template.label}
      </span>
    </button>
  );
}

function TemplateThumbnail({
  kind,
  template,
}: {
  kind: NativeKind;
  template: NativeTemplateEntry;
}) {
  return <ItemThumbnail source={templateItemPreviewSource(kind, template)} className="aspect-4/3 w-full" />;
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
        <span className="flex flex-col gap-1 border-t border-border px-3 py-2.5">
          <span className="truncate text-sm font-medium" title={item.title}>
            {item.title || "Untitled"}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <LibraryIcon icon={item.libraryIcon} className="size-3.5" />
            <span className="truncate">{item.libraryName}</span>
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
    <div className="group flex items-center gap-3 bg-card px-3 py-2.5 transition-colors hover:bg-muted/50">
      <Link
        href={nativeEditorRoute(kind, item.id)}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <FileArtwork type={item.type} className="size-7 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium" title={item.title}>
          {item.title || "Untitled"}
        </span>
      </Link>
      {item.collaborators.length > 0 && (
        <CollaboratorAvatars people={item.collaborators} size="xs" className="hidden sm:flex" />
      )}
      <span className="hidden min-w-0 items-center gap-1.5 text-xs text-muted-foreground sm:flex">
        <LibraryIcon icon={item.libraryIcon} className="size-3.5" />
        <span className="max-w-40 truncate">{item.libraryName}</span>
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {formatRelativeTime(item.updatedAt)}
      </span>
      <PinButton item={item} onTogglePin={onTogglePin} className={item.pinned ? "" : "opacity-100 sm:opacity-0"} />
    </div>
  );
}

function RecentThumbnail({ item }: { item: RecentItem }) {
  return (
    <ItemThumbnail source={recentItemPreviewSource(item)} className="aspect-4/3 w-full" />
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

function EmptyState({
  kind,
  canCreate,
}: {
  kind: NativeKind;
  canCreate: boolean;
}) {
  const cfg = NATIVE_TYPES[kind];
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
      <FileArtwork type={cfg.artworkType} className="size-12" />
      <div>
        <p className="text-sm font-medium">No {cfg.plural.toLowerCase()} yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {canCreate
            ? `Create your first ${cfg.label.toLowerCase()} to see it here.`
            : `Upload files from your library to see them here.`}
        </p>
      </div>
    </div>
  );
}
