"use client";

import { useEffect, useState } from "react";
import { DatabasePreview } from "@/components/database/database-preview";
import { FlowPreview } from "@/components/flowcharts/flow-preview";
import { PdfPreviewThumb } from "@/components/pdf/pdf-page-preview";
import { DeckSlideSvg } from "@/components/slideshow/deck-slide-svg";
import { BoardPreview } from "@/components/whiteboard/board-preview";
import { FileArtwork } from "@/lib/client/file-icons";
import { apiGet } from "@/lib/client/api";
import type { BoardDoc } from "@/lib/boards/board-schema";
import type { Slide } from "@/lib/decks/deck-schema";
import type { DatabaseScene } from "@/lib/databases/database-schema";
import type { FlowDoc } from "@/lib/flowcharts/flowchart-schema";
import { cn } from "@/lib/core/utils";
import {
  normalizeEditorContent,
  type RecallPartialBlock,
} from "@/lib/editor/editor-content";

const pageExcerptCache = new Map<string, string>();

async function fetchPageExcerpt(pageId: string): Promise<string> {
  const cached = pageExcerptCache.get(pageId);
  if (cached !== undefined) return cached;
  const data = await apiGet<{ plainText?: string }>(`/api/pages/${pageId}`);
  const text = (data.plainText ?? "").trim();
  pageExcerptCache.set(pageId, text);
  return text;
}

const deckSlideCache = new Map<string, Slide | null>();

async function fetchDeckFirstSlide(deckId: string): Promise<Slide | null> {
  const cached = deckSlideCache.get(deckId);
  if (cached !== undefined) return cached;
  const data = await apiGet<{ deck: { slideOrder: string[]; slides: Record<string, Slide> } }>(
    `/api/decks/${deckId}`
  );
  const slide = data.deck.slides[data.deck.slideOrder[0]] ?? null;
  deckSlideCache.set(deckId, slide);
  return slide;
}

const boardSceneCache = new Map<string, BoardDoc | null>();

async function fetchBoardScene(boardId: string): Promise<BoardDoc | null> {
  const cached = boardSceneCache.get(boardId);
  if (cached !== undefined) return cached;
  const data = await apiGet<{ scene: BoardDoc }>(`/api/boards/${boardId}`);
  boardSceneCache.set(boardId, data.scene);
  return data.scene;
}

const flowSceneCache = new Map<string, FlowDoc | null>();

async function fetchFlowScene(flowId: string): Promise<FlowDoc | null> {
  const cached = flowSceneCache.get(flowId);
  if (cached !== undefined) return cached;
  const data = await apiGet<{ scene: FlowDoc }>(`/api/flowcharts/${flowId}`);
  flowSceneCache.set(flowId, data.scene);
  return data.scene;
}

const databaseSceneCache = new Map<string, DatabaseScene | null>();

async function fetchDatabaseScene(databaseId: string): Promise<DatabaseScene | null> {
  const cached = databaseSceneCache.get(databaseId);
  if (cached !== undefined) return cached;
  const data = await apiGet<DatabaseScene>(`/api/databases/${databaseId}`);
  databaseSceneCache.set(databaseId, data);
  return data;
}

/** Preview chrome shared by library entity cards and native home recents. */
export function ItemPreviewPane({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-muted/30",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Faux paper sheet — used by library cards and native home. */
export function PagePreviewContent({
  title,
  text,
}: {
  title: string;
  text: string | null;
}) {
  const lines = (text ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 9);

  return (
    <div className="absolute inset-0 overflow-hidden bg-white px-3.5 pt-3 dark:bg-zinc-50">
      <p className="line-clamp-1 text-[9px] font-semibold leading-tight text-slate-800">{title}</p>
      {lines.length > 0 ? (
        <div className="mt-1.5 space-y-0.5">
          {lines.map((line, index) => (
            <p
              key={`${index}-${line.slice(0, 24)}`}
              className={cn(
                "line-clamp-2 text-[7.5px] leading-[1.55]",
                index === 0
                  ? "font-semibold text-slate-700"
                  : line.length < 42 && !line.startsWith("•")
                    ? "font-medium text-slate-600"
                    : "text-slate-500"
              )}
            >
              {line}
            </p>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-[7.5px] italic text-slate-400">Empty page</p>
      )}
    </div>
  );
}

const PREVIEW_BLOCK_LIMIT = 11;

function inlinePreviewText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "text" in item) {
        return String((item as { text?: string }).text ?? "");
      }
      return "";
    })
    .join("");
}

function flattenPreviewBlocks(blocks: RecallPartialBlock[]): RecallPartialBlock[] {
  const flat: RecallPartialBlock[] = [];
  function walk(list: RecallPartialBlock[]) {
    for (const block of list) {
      flat.push(block);
      if (block.children?.length) walk(block.children);
    }
  }
  walk(blocks);
  return flat;
}

function PreviewBlockLine({ block }: { block: RecallPartialBlock }) {
  const text = inlinePreviewText(block.content).trim();
  if (!text) return null;

  if (block.type === "heading") {
    const level = Number((block.props as { level?: number } | undefined)?.level ?? 1);
    return (
      <p
        className={cn(
          "line-clamp-2 leading-tight text-slate-800",
          level === 1 && "text-[8.5px] font-bold",
          level === 2 && "text-[8px] font-semibold",
          level >= 3 && "text-[7.5px] font-medium text-slate-700"
        )}
      >
        {text}
      </p>
    );
  }

  if (block.type === "bulletListItem") {
    return (
      <p className="flex gap-1 text-[7px] leading-[1.5] text-slate-500">
        <span className="shrink-0 text-slate-400">•</span>
        <span className="line-clamp-2 min-w-0">{text}</span>
      </p>
    );
  }

  return <p className="line-clamp-2 text-[7px] leading-[1.5] text-slate-500">{text}</p>;
}

/** Miniature doc preview from BlockNote JSON — shows real heading/list structure. */
export function PageStructuredPreview({
  title,
  blocks,
}: {
  title: string;
  blocks: unknown;
}) {
  const visible = flattenPreviewBlocks(normalizeEditorContent(blocks)).slice(
    0,
    PREVIEW_BLOCK_LIMIT
  );

  return (
    <div className="absolute inset-0 overflow-hidden bg-white px-3.5 pt-3 dark:bg-zinc-50">
      <p className="line-clamp-1 text-[9px] font-semibold leading-tight text-slate-800">{title}</p>
      <div className="mt-1.5 space-y-0.5">
        {visible.map((block, index) => (
          <PreviewBlockLine key={block.id ?? `${block.type}-${index}`} block={block} />
        ))}
      </div>
    </div>
  );
}

/** Fetches plainText and renders the library page thumbnail. */
export function PagePreview({ pageId, title }: { pageId: string; title: string }) {
  const [text, setText] = useState<string | null>(pageExcerptCache.get(pageId) ?? null);

  useEffect(() => {
    if (text !== null) return;
    let cancelled = false;
    fetchPageExcerpt(pageId)
      .then((value) => {
        if (!cancelled) setText(value);
      })
      .catch(() => {
        if (!cancelled) setText("");
      });
    return () => {
      cancelled = true;
    };
  }, [pageId, text]);

  return <PagePreviewContent title={title} text={text} />;
}

/** First-slide deck thumbnail (library cards + native home). */
export function DeckPreview({ deckId, slide: slideOverride }: { deckId?: string; slide?: Slide }) {
  const [slide, setSlide] = useState<Slide | null | undefined>(
    slideOverride ?? (deckId ? deckSlideCache.get(deckId) : undefined)
  );

  useEffect(() => {
    if (slideOverride || !deckId || slide !== undefined) return;
    let cancelled = false;
    fetchDeckFirstSlide(deckId)
      .then((value) => {
        if (!cancelled) setSlide(value);
      })
      .catch(() => {
        if (!cancelled) setSlide(null);
      });
    return () => {
      cancelled = true;
    };
  }, [deckId, slide, slideOverride]);

  const resolved = slideOverride ?? slide ?? undefined;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-muted/40 p-2.5">
      <div className="w-full overflow-hidden rounded-sm border border-border/60">
        <DeckSlideSvg slide={resolved} className="w-full" />
      </div>
    </div>
  );
}

/** Whiteboard scene thumbnail (library cards + native home). */
export function BoardPreviewThumb({
  boardId,
  scene: sceneOverride,
}: {
  boardId?: string;
  scene?: BoardDoc;
}) {
  const [scene, setScene] = useState<BoardDoc | null | undefined>(
    sceneOverride ?? (boardId ? boardSceneCache.get(boardId) : undefined)
  );

  useEffect(() => {
    if (sceneOverride || !boardId || scene !== undefined) return;
    let cancelled = false;
    fetchBoardScene(boardId)
      .then((value) => {
        if (!cancelled) setScene(value);
      })
      .catch(() => {
        if (!cancelled) setScene(null);
      });
    return () => {
      cancelled = true;
    };
  }, [boardId, scene, sceneOverride]);

  const resolved = sceneOverride ?? scene ?? null;

  return (
    <div className="absolute inset-0 flex items-center justify-center p-2">
      {resolved ? (
        <BoardPreview scene={resolved} className="h-full w-full" />
      ) : (
        <FileArtwork type="WHITEBOARD" className="size-14" />
      )}
    </div>
  );
}

/** Flowchart scene thumbnail (library cards + native home). */
export function FlowPreviewThumb({
  flowId,
  scene: sceneOverride,
}: {
  flowId?: string;
  scene?: FlowDoc;
}) {
  const [scene, setScene] = useState<FlowDoc | null | undefined>(
    sceneOverride ?? (flowId ? flowSceneCache.get(flowId) : undefined)
  );

  useEffect(() => {
    if (sceneOverride || !flowId || scene !== undefined) return;
    let cancelled = false;
    fetchFlowScene(flowId)
      .then((value) => {
        if (!cancelled) setScene(value);
      })
      .catch(() => {
        if (!cancelled) setScene(null);
      });
    return () => {
      cancelled = true;
    };
  }, [flowId, scene, sceneOverride]);

  const resolved = sceneOverride ?? scene ?? null;

  return (
    <div className="absolute inset-0 flex items-center justify-center p-2.5">
      {resolved ? (
        <FlowPreview scene={resolved} className="h-full w-full" />
      ) : (
        <FileArtwork type="FLOWCHART" className="size-14" />
      )}
    </div>
  );
}

/** Database table thumbnail (library cards + native home). */
export function DatabasePreviewThumb({
  databaseId,
  scene: sceneOverride,
}: {
  databaseId?: string;
  scene?: DatabaseScene;
}) {
  const [scene, setScene] = useState<DatabaseScene | null | undefined>(
    sceneOverride ?? (databaseId ? databaseSceneCache.get(databaseId) : undefined)
  );

  useEffect(() => {
    if (sceneOverride || !databaseId || scene !== undefined) return;
    let cancelled = false;
    fetchDatabaseScene(databaseId)
      .then((value) => {
        if (!cancelled) setScene(value);
      })
      .catch(() => {
        if (!cancelled) setScene(null);
      });
    return () => {
      cancelled = true;
    };
  }, [databaseId, scene, sceneOverride]);

  const resolved = sceneOverride ?? scene ?? null;

  return resolved ? (
    <DatabasePreview scene={resolved} />
  ) : (
    <div className="flex size-full items-center justify-center">
      <FileArtwork type="DATABASE" className="size-14" />
    </div>
  );
}

/** Fallback glyph when there is no richer preview (matches library entity cards). */
export function FileTypePreview({ type }: { type: string }) {
  return (
    <div className="flex size-full items-center justify-center">
      <FileArtwork type={type} className="size-14" />
    </div>
  );
}

/** Discriminated input for the shared page / deck / file preview router. */
export type ItemPreviewSource =
  | { mode: "page"; pageId: string; title: string }
  | { mode: "page-static"; title: string; text: string }
  | { mode: "page-blocks"; title: string; blocks: unknown }
  | { mode: "deck"; deckId?: string; slide?: Slide }
  | { mode: "board"; boardId?: string; scene?: BoardDoc }
  | { mode: "flow"; flowId?: string; scene?: FlowDoc }
  | { mode: "database"; databaseId?: string; scene?: DatabaseScene }
  | { mode: "pdf"; documentId: string }
  | { mode: "file"; type: string };

/** Inner preview — pick page, deck, board, flow, database, or file glyph. */
export function ItemPreviewBody({ source }: { source: ItemPreviewSource }) {
  switch (source.mode) {
    case "page":
      return <PagePreview pageId={source.pageId} title={source.title} />;
    case "page-static":
      return <PagePreviewContent title={source.title} text={source.text} />;
    case "page-blocks":
      return <PageStructuredPreview title={source.title} blocks={source.blocks} />;
    case "deck":
      return <DeckPreview deckId={source.deckId} slide={source.slide} />;
    case "board":
      return <BoardPreviewThumb boardId={source.boardId} scene={source.scene} />;
    case "flow":
      return <FlowPreviewThumb flowId={source.flowId} scene={source.scene} />;
    case "database":
      return <DatabasePreviewThumb databaseId={source.databaseId} scene={source.scene} />;
    case "pdf":
      return <PdfPreviewThumb documentId={source.documentId} />;
    case "file":
      return <FileTypePreview type={source.type} />;
  }
}

/** Preview pane + body — used by native home cards and template tiles. */
export function ItemThumbnail({
  source,
  className,
}: {
  source: ItemPreviewSource;
  className?: string;
}) {
  return (
    <ItemPreviewPane className={className}>
      <ItemPreviewBody source={source} />
    </ItemPreviewPane>
  );
}

/** Map a library cloud item to a standard preview (page, deck, or file glyph). */
export function cloudItemPreviewSource(
  item: { kind: "page"; id: string; title: string } | { kind: "document"; id: string; type: string }
): ItemPreviewSource {
  if (item.kind === "page") {
    return { mode: "page", pageId: item.id, title: item.title };
  }
  switch (item.type) {
    case "DECK":
      return { mode: "deck", deckId: item.id };
    case "WHITEBOARD":
      return { mode: "board", boardId: item.id };
    case "FLOWCHART":
      return { mode: "flow", flowId: item.id };
    case "DATABASE":
      return { mode: "database", databaseId: item.id };
    case "PDF":
      return { mode: "pdf", documentId: item.id };
    default:
      return { mode: "file", type: item.type };
  }
}

/** Map a native-home recent row to a standard preview. */
export function recentItemPreviewSource(item: {
  id: string;
  title: string;
  type: string;
}): ItemPreviewSource {
  switch (item.type) {
    case "PAGE":
      return { mode: "page", pageId: item.id, title: item.title || "Untitled" };
    case "DECK":
      return { mode: "deck", deckId: item.id };
    case "WHITEBOARD":
      return { mode: "board", boardId: item.id };
    case "FLOWCHART":
      return { mode: "flow", flowId: item.id };
    case "DATABASE":
      return { mode: "database", databaseId: item.id };
    case "PDF":
      return { mode: "pdf", documentId: item.id };
    default:
      return { mode: "file", type: item.type };
  }
}
