"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownAZ, ArrowUpZA, ChevronDown, Loader2, Plus, Search } from "lucide-react";
import { LibraryIcon } from "@/components/icons/library-icon";
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
import { DeckSlideSvg } from "@/components/slideshow/deck-slide-svg";
import { BoardPreview } from "@/components/whiteboard/board-preview";
import { FileArtwork } from "@/lib/client/file-icons";
import { apiGet } from "@/lib/client/api";
import type { Slide } from "@/lib/decks/deck-schema";
import type { BoardDoc } from "@/lib/boards/board-schema";
import { createBlankNative, createFromNativeTemplate } from "@/lib/native/create-from-template";
import { listNativeTemplates, type NativeTemplateEntry } from "@/lib/native/native-templates";
import { getBoardTemplate } from "@/lib/native/board-templates";
import { getFlowTemplate } from "@/lib/native/flow-templates";
import { presentationThumbnailSlide } from "@/lib/decks/presentation-templates";
import { NATIVE_TYPES, type NativeKind } from "@/lib/native/native-types";
import type { RecentItem } from "@/lib/native/recents";
import {
  libraryHome,
  nativeEditorRoute,
  readStoredLibraryId,
} from "@/lib/client/routes";
import { formatRelativeTime } from "@/lib/core/utils";

type Library = { id: string; name: string; icon: string; role?: string };

type SortMode = "recent" | "name-asc" | "name-desc";

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
  const [sort, setSort] = useState<SortMode>("recent");

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
  }, [items, trimmedQuery, libraryFilter, sort]);

  const hasActiveFilters = trimmedQuery.length > 0 || libraryFilter !== "all" || sort !== "recent";

  const featured = hasActiveFilters ? [] : filtered.slice(0, 4);
  // The full list always shows every item — featured cards are just a highlight
  // on top, not a removal from the list.
  const rest = filtered;

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
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <li>
                <button
                  type="button"
                  onClick={handleCreateBlank}
                  disabled={!!creatingId || !activeLibraryId}
                  className="group flex w-full flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition-all hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-md disabled:pointer-events-none disabled:opacity-60"
                >
                  <span
                    className="flex h-28 items-center justify-center"
                    style={{ backgroundColor: `${cfg.accent}14` }}
                  >
                    {creatingId === "blank" ? (
                      <Loader2 className="size-7 animate-spin text-muted-foreground" />
                    ) : (
                      <span
                        className="flex size-11 items-center justify-center rounded-full text-white shadow-sm transition-transform group-hover:scale-105"
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
                <li key={template.id}>
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

        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              {hasActiveFilters ? "Results" : "Recent"}
            </h2>
            {items && items.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
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
            )}
          </div>

          {items === null ? (
            <RecentsSkeleton />
          ) : items.length === 0 ? (
            <EmptyState kind={kind} canCreate={cfg.creatable} />
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center text-sm text-muted-foreground">
              {trimmedQuery
                ? `No ${cfg.plural.toLowerCase()} match “${query.trim()}”.`
                : libraryFilter !== "all"
                  ? `No ${cfg.plural.toLowerCase()} in this library.`
                  : `No ${cfg.plural.toLowerCase()} match your filters.`}
            </div>
          ) : (
            <>
              {featured.length > 0 && (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {featured.map((item) => (
                    <li key={item.id}>
                      <RecentCard item={item} kind={kind} />
                    </li>
                  ))}
                </ul>
              )}

              {rest.length > 0 && (
                <>
                  {!hasActiveFilters && (
                    <h3 className="mb-2 mt-8 text-sm font-medium text-muted-foreground">
                      All {cfg.plural.toLowerCase()}
                    </h3>
                  )}
                  <ul className="overflow-hidden rounded-xl border border-border divide-y divide-border">
                    {rest.map((item) => (
                      <li key={item.id}>
                        <RecentRow item={item} kind={kind} />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </section>
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
      className="group flex w-full flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition-all hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-md disabled:pointer-events-none disabled:opacity-60"
    >
      {loading ? (
        <span className="flex h-28 items-center justify-center bg-muted/40">
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
  if (template.preview) {
    return (
      <span className="flex h-28 justify-center overflow-hidden bg-muted/40 pt-3">
        <span className="relative flex h-full w-[78%] flex-col gap-1 overflow-hidden rounded-t-sm bg-white px-3 pt-3 text-slate-700 shadow-sm">
          <span className="line-clamp-2 text-[9px] font-semibold leading-tight text-slate-900">
            {template.title}
          </span>
          <span className="whitespace-pre-wrap wrap-break-word text-[6.5px] leading-[1.45] text-slate-500">
            {template.preview}
          </span>
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-white to-transparent" />
        </span>
      </span>
    );
  }
  if (kind === "slides") {
    const slide = presentationThumbnailSlide(template.id);
    return (
      <span className="flex h-28 items-center justify-center overflow-hidden bg-muted/40 p-3">
        <span className="w-full overflow-hidden rounded-sm border border-border/60 shadow-sm">
          <DeckSlideSvg slide={slide} className="w-full" />
        </span>
      </span>
    );
  }
  if (kind === "whiteboards") {
    const scene = getBoardTemplate(template.id).build();
    return (
      <span className="flex h-28 items-center justify-center overflow-hidden bg-muted/40 p-2">
        <BoardPreview scene={scene} className="h-full w-full" />
      </span>
    );
  }
  if (kind === "flowcharts") {
    return <FlowTemplateThumb templateId={template.id} />;
  }
  return (
    <span className="flex h-28 items-center justify-center bg-muted/40">
      <FileArtwork type={NATIVE_TYPES[kind].artworkType} className="size-12" />
    </span>
  );
}

/** Minimal node diagram for flowchart template cards. */
function FlowTemplateThumb({ templateId }: { templateId: string }) {
  const scene = getFlowTemplate(templateId).build();
  const nodes = scene.nodeOrder.map((id) => scene.nodes[id]).filter(Boolean);
  if (nodes.length === 0) {
    return (
      <span className="flex h-28 items-center justify-center bg-muted/40">
        <FileArtwork type="FLOWCHART" className="size-12" />
      </span>
    );
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + 120);
    maxY = Math.max(maxY, n.y + 48);
  }
  const pad = 24;
  const w = Math.max(1, maxX - minX + pad * 2);
  const h = Math.max(1, maxY - minY + pad * 2);
  return (
    <span className="flex h-28 items-center justify-center overflow-hidden bg-muted/40 p-3">
      <svg
        viewBox={`${minX - pad} ${minY - pad} ${w} ${h}`}
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        {scene.edgeOrder.map((eid) => {
          const e = scene.edges[eid];
          const a = scene.nodes[e.source];
          const b = scene.nodes[e.target];
          if (!a || !b) return null;
          return (
            <line
              key={eid}
              x1={a.x + 60}
              y1={a.y + 24}
              x2={b.x + 60}
              y2={b.y + 24}
              stroke="#94a3b8"
              strokeWidth={2}
            />
          );
        })}
        {nodes.map((n) => (
          <rect
            key={n.id}
            x={n.x}
            y={n.y}
            width={120}
            height={48}
            rx={n.shape === "diamond" ? 4 : 8}
            fill="#eef2ff"
            stroke="#6366f1"
            strokeWidth={2}
          />
        ))}
      </svg>
    </span>
  );
}

/** Featured preview card (used for the most-recent items). */
function RecentCard({ item, kind }: { item: RecentItem; kind: NativeKind }) {
  return (
    <Link
      href={nativeEditorRoute(kind, item.id)}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-md"
    >
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
        </span>
      </span>
    </Link>
  );
}

/** Compact list row for the remaining (older / searched) items. */
function RecentRow({ item, kind }: { item: RecentItem; kind: NativeKind }) {
  return (
    <Link
      href={nativeEditorRoute(kind, item.id)}
      className="flex items-center gap-3 bg-card px-3 py-2.5 transition-colors hover:bg-muted/50"
    >
      <FileArtwork type={item.type} className="size-7 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-sm font-medium" title={item.title}>
        {item.title || "Untitled"}
      </span>
      <span className="hidden min-w-0 items-center gap-1.5 text-xs text-muted-foreground sm:flex">
        <LibraryIcon icon={item.libraryIcon} className="size-3.5" />
        <span className="max-w-40 truncate">{item.libraryName}</span>
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {formatRelativeTime(item.updatedAt)}
      </span>
    </Link>
  );
}

/**
 * Card thumbnail: a miniature white "page" rendering the doc's actual text for
 * content-bearing items, falling back to the type artwork for canvas/file types.
 */
function RecentThumbnail({ item }: { item: RecentItem }) {
  if (item.preview) {
    return (
      <span className="flex h-28 justify-center overflow-hidden bg-muted/40 pt-3">
        <span className="relative flex h-full w-[78%] flex-col gap-1 overflow-hidden rounded-t-sm bg-white px-3 pt-3 text-slate-700 shadow-sm">
          <span className="line-clamp-2 text-[9px] font-semibold leading-tight text-slate-900">
            {item.title || "Untitled"}
          </span>
          <span className="whitespace-pre-wrap wrap-break-word text-[6.5px] leading-[1.45] text-slate-500">
            {item.preview}
          </span>
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-white to-transparent" />
        </span>
      </span>
    );
  }
  if (item.type === "DECK") return <DeckThumbnail id={item.id} />;
  if (item.type === "WHITEBOARD") return <BoardThumbnail id={item.id} />;
  return (
    <span className="flex h-28 items-center justify-center bg-muted/40">
      <FileArtwork type={item.type} className="size-12" />
    </span>
  );
}

const deckSlideCache = new Map<string, Slide | null>();

/** First-slide render for a deck card thumbnail (fetched lazily, cached). */
function DeckThumbnail({ id }: { id: string }) {
  const [slide, setSlide] = useState<Slide | null | undefined>(
    deckSlideCache.get(id)
  );

  useEffect(() => {
    if (slide !== undefined) return;
    let cancelled = false;
    apiGet<{ deck: { slideOrder: string[]; slides: Record<string, Slide> } }>(
      `/api/decks/${id}`
    )
      .then((d) => {
        const first = d.deck.slides[d.deck.slideOrder[0]] ?? null;
        deckSlideCache.set(id, first);
        if (!cancelled) setSlide(first);
      })
      .catch(() => !cancelled && setSlide(null));
    return () => {
      cancelled = true;
    };
  }, [id, slide]);

  return (
    <span className="flex h-28 items-center justify-center overflow-hidden bg-muted/40 p-3">
      <span className="w-full overflow-hidden rounded-sm border border-border/60 shadow-sm">
        <DeckSlideSvg slide={slide ?? undefined} className="w-full" />
      </span>
    </span>
  );
}

const boardSceneCache = new Map<string, BoardDoc | null>();

/** Scaled scene render for a whiteboard card thumbnail (fetched lazily, cached). */
function BoardThumbnail({ id }: { id: string }) {
  const [scene, setScene] = useState<BoardDoc | null | undefined>(
    boardSceneCache.get(id)
  );

  useEffect(() => {
    if (scene !== undefined) return;
    let cancelled = false;
    apiGet<{ scene: BoardDoc }>(`/api/boards/${id}`)
      .then((d) => {
        boardSceneCache.set(id, d.scene);
        if (!cancelled) setScene(d.scene);
      })
      .catch(() => !cancelled && setScene(null));
    return () => {
      cancelled = true;
    };
  }, [id, scene]);

  return (
    <span className="flex h-28 items-center justify-center overflow-hidden bg-muted/40 p-2">
      {scene ? (
        <BoardPreview scene={scene} className="h-full w-full" />
      ) : (
        <FileArtwork type="WHITEBOARD" className="size-12" />
      )}
    </span>
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
          <div className="h-28 animate-pulse bg-muted/50" />
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
