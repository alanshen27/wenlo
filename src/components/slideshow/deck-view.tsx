"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { Download, Loader2, Play } from "lucide-react";
import { useLibraryHeader, useLibraryScope, useLibraryTree } from "@/components/library/context";
import { useDocumentHeader } from "@/hooks/use-document-header";
import { useDebouncedPersist } from "@/hooks/use-debounced-persist";
import { useDeckDocument } from "@/hooks/use-native-documents";
import { useSaveStatus } from "@/hooks/use-save-status";
import { Button } from "@/components/ui/button";
import {
  createEmptyDeck,
  newDeckId,
  normalizeDeck,
  type DeckDoc,
  type DeckElement,
  type Slide,
} from "@/lib/decks/deck-schema";
import { applyScenePatch } from "@/lib/scene/scene-schema";
import { DECK_SCENE_CONFIG } from "@/lib/scene/scene-config";
import { createSlideFromTemplate } from "@/lib/decks/deck-templates";
import { apiPatch } from "@/lib/client/api";
import { ViewError } from "@/components/ui/view";

const SceneCanvasLazy = dynamic(
  () => import("@/components/canvas/scene-canvas").then((m) => m.SceneCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-muted/30">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

const PresentOverlay = dynamic(
  () => import("@/components/slideshow/present-overlay").then((m) => m.PresentOverlay),
  { ssr: false }
);

const SlideRail = dynamic(
  () => import("@/components/slideshow/slide-rail").then((m) => m.SlideRail),
  { ssr: false }
);

const SAVE_DEBOUNCE_MS = 600;

export function DeckView() {
  const { deckId } = useParams<{ deckId: string }>();
  const { libraryId, canEdit } = useLibraryScope();
  const { refreshTree } = useLibraryTree();
  const { setHeader } = useLibraryHeader();
  const { saveStatus, markSaving, markSaved, markError } = useSaveStatus();
  const { data: meta, isLoading, loadError, reload } = useDeckDocument(deckId, libraryId);

  const [deck, setDeck] = useState<DeckDoc>(createEmptyDeck());
  const [activeSlideId, setActiveSlideId] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [presentFrom, setPresentFrom] = useState<number | null>(null);

  const latestDeck = useRef<DeckDoc>(deck);

  const readOnly = !canEdit;

  useEffect(() => {
    if (!meta) return;
    const normalized = normalizeDeck(meta.deck as DeckDoc);
    setDeck(normalized);
    latestDeck.current = normalized;
    setActiveSlideId(normalized.slideOrder[0] ?? "");
    setTitle(meta.title);
  }, [meta?.id]);

  const { markDirty, flushNow } = useDebouncedPersist({
    debounceMs: SAVE_DEBOUNCE_MS,
    shouldPersist: () => !readOnly && Boolean(meta),
    getPayload: () => latestDeck.current,
    persist: async (payload) => {
      await apiPatch(`/api/decks/${deckId}`, { deck: payload });
    },
    markSaving,
    markSaved,
    markError,
  });

  const mutate = useCallback(
    (next: DeckDoc) => {
      latestDeck.current = next;
      setDeck(next);
      markDirty();
    },
    [markDirty]
  );

  const headerState = useMemo(() => {
    if (!meta) return undefined;
    return { saveStatus, titleOverride: title, folderIdFallback: meta.folderId };
  }, [meta, saveStatus, title]);

  useDocumentHeader(setHeader, headerState);

  // --- Slide helpers ---
  const updateActiveSlide = useCallback(
    (updater: (slide: Slide) => Slide) => {
      const slide = deck.slides[activeSlideId];
      if (!slide) return;
      const nextSlide = updater(slide);
      mutate({ ...deck, slides: { ...deck.slides, [activeSlideId]: nextSlide } });
    },
    [deck, activeSlideId, mutate]
  );

  const handleScenePatch = useCallback(
    (patch: Parameters<typeof applyScenePatch>[1]) => {
      updateActiveSlide((slide) => {
        const merged = applyScenePatch(
          { version: 2, elementOrder: slide.elementOrder, elements: slide.elements },
          patch
        );
        return {
          ...slide,
          elementOrder: merged.elementOrder,
          elements: merged.elements as Record<string, DeckElement>,
        };
      });
    },
    [updateActiveSlide]
  );

  const addSlide = useCallback(
    (templateId?: string) => {
      const slide = createSlideFromTemplate(templateId);
      const index = deck.slideOrder.indexOf(activeSlideId);
      const order = [...deck.slideOrder];
      order.splice(index + 1, 0, slide.id);
      mutate({ ...deck, slideOrder: order, slides: { ...deck.slides, [slide.id]: slide } });
      setActiveSlideId(slide.id);
      setSelectedId(null);
    },
    [deck, activeSlideId, mutate]
  );

  const duplicateSlide = useCallback(
    (slideId: string) => {
      const source = deck.slides[slideId];
      if (!source) return;
      const newSlideId = newDeckId("sl");
      const elements: Record<string, DeckElement> = {};
      const elementOrder: string[] = [];
      for (const oldId of source.elementOrder) {
        const el = source.elements[oldId];
        if (!el) continue;
        const id = newDeckId();
        elements[id] = { ...el, id };
        elementOrder.push(id);
      }
      const copy: Slide = { ...source, id: newSlideId, elements, elementOrder };
      const index = deck.slideOrder.indexOf(slideId);
      const order = [...deck.slideOrder];
      order.splice(index + 1, 0, newSlideId);
      mutate({ ...deck, slideOrder: order, slides: { ...deck.slides, [newSlideId]: copy } });
      setActiveSlideId(newSlideId);
      setSelectedId(null);
    },
    [deck, mutate]
  );

  const deleteSlide = useCallback(
    (slideId: string) => {
      if (deck.slideOrder.length <= 1) return;
      const index = deck.slideOrder.indexOf(slideId);
      const order = deck.slideOrder.filter((id) => id !== slideId);
      const slides = { ...deck.slides };
      delete slides[slideId];
      mutate({ ...deck, slideOrder: order, slides });
      if (activeSlideId === slideId) {
        setActiveSlideId(order[Math.max(0, index - 1)]);
        setSelectedId(null);
      }
    },
    [deck, activeSlideId, mutate]
  );

  const reorderSlides = useCallback(
    (slideId: string, toIndex: number) => {
      const from = deck.slideOrder.indexOf(slideId);
      if (from === -1) return;
      const order = [...deck.slideOrder];
      order.splice(from, 1);
      order.splice(toIndex, 0, slideId);
      mutate({ ...deck, slideOrder: order });
    },
    [deck, mutate]
  );

  const selectSlide = useCallback((slideId: string) => {
    setActiveSlideId(slideId);
    setSelectedId(null);
  }, []);

  // --- Title ---
  const saveTitle = useCallback(async () => {
    if (!meta || !canEdit || title === meta.title) return;
    try {
      const updated = await apiPatch<{ title: string }>(`/api/documents/${meta.id}`, { title });
      setTitle(updated.title);
      refreshTree();
    } catch {
      /* keep local title */
    }
  }, [meta, canEdit, title, refreshTree]);

  const handleExport = useCallback(() => {
    flushNow();
    const link = document.createElement("a");
    link.href = `/api/decks/${deckId}/export`;
    link.download = `${title || "deck"}.pptx`;
    link.click();
  }, [deckId, title, flushNow]);

  const activeSlide = deck.slides[activeSlideId];

  const canvas = useMemo(() => {
    if (!meta || !activeSlide) return null;
    return (
      <SceneCanvasLazy
        config={DECK_SCENE_CONFIG}
        scene={{
          version: 2,
          elementOrder: activeSlide.elementOrder,
          elements: activeSlide.elements,
        }}
        background={activeSlide.background}
        sceneKey={activeSlide.id}
        readOnly={readOnly}
        libraryId={meta.libraryId}
        folderId={meta.folderId}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onPatch={handleScenePatch}
        onPresent={() => setPresentFrom(deck.slideOrder.indexOf(activeSlideId))}
      />
    );
  }, [
    meta,
    activeSlide,
    readOnly,
    selectedId,
    handleScenePatch,
    deck.slideOrder,
    activeSlideId,
  ]);

  if (loadError) {
    return (
      <ViewError
        title="Couldn't load this deck"
        message={loadError}
        onRetry={reload}
      />
    );
  }

  if (isLoading || !meta) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          readOnly={readOnly}
          placeholder="Untitled deck"
          className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none read-only:cursor-default"
        />
        {readOnly && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            Read-only
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPresentFrom(deck.slideOrder.indexOf(activeSlideId))}
        >
          <Play className="size-4" />
          Present
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="size-4" />
          Export .pptx
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <SlideRail
          deck={deck}
          activeSlideId={activeSlideId}
          readOnly={readOnly}
          onSelect={selectSlide}
          onAdd={addSlide}
          onReorder={reorderSlides}
          onDuplicate={duplicateSlide}
          onDelete={deleteSlide}
        />
        <div className="relative flex-1">{canvas}</div>
      </div>

      {presentFrom !== null && (
        <PresentOverlay
          deck={deck}
          startIndex={presentFrom}
          onExit={() => setPresentFrom(null)}
        />
      )}
    </div>
  );
}
