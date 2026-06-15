"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { Download, Loader2, Play } from "lucide-react";
import { useLibrary } from "@/components/library/library-shell";
import type { SaveStatus } from "@/components/library/main-header";
import { Button } from "@/components/ui/button";
import {
  createEmptyDeck,
  newDeckId,
  normalizeDeck,
  type DeckDoc,
  type DeckElement,
  type Slide,
} from "@/lib/decks/deck-schema";
import { createSlideFromTemplate } from "@/lib/decks/deck-templates";
import {
  apiGet,
  apiPatch,
  getApiErrorMessage,
  isCanceledError,
  isNotFoundError,
} from "@/lib/client/api";
import { ViewError } from "@/components/ui/view";
import { deckRoute, libraryHome } from "@/lib/client/routes";

const DeckCanvas = dynamic(
  () => import("@/components/slideshow/deck-canvas").then((m) => m.DeckCanvas),
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

type DeckData = {
  id: string;
  title: string;
  folderId: string | null;
  libraryId: string;
  deck: DeckDoc;
};

const SAVE_DEBOUNCE_MS = 600;

export function DeckView() {
  const router = useRouter();
  const { deckId } = useParams<{ deckId: string }>();
  const { libraryId, canEdit, setHeader, refreshTree } = useLibrary();

  const [meta, setMeta] = useState<DeckData | null>(null);
  const [deck, setDeck] = useState<DeckDoc>(createEmptyDeck());
  const [activeSlideId, setActiveSlideId] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [presentFrom, setPresentFrom] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDeck = useRef<DeckDoc>(deck);
  const dirty = useRef(false);

  const readOnly = !canEdit;

  // --- Load ---
  useEffect(() => {
    let cancelled = false;
    setMeta(null);
    setDeck(createEmptyDeck());
    setSaveStatus("idle");
    setLoadError(null);
    void (async () => {
      try {
        const data = await apiGet<DeckData>(`/api/decks/${deckId}`);
        if (cancelled) return;
        if (data.libraryId && data.libraryId !== libraryId) {
          router.replace(deckRoute(data.libraryId, data.id));
          return;
        }
        const normalized = normalizeDeck(data.deck);
        setMeta(data);
        setDeck(normalized);
        latestDeck.current = normalized;
        setActiveSlideId(normalized.slideOrder[0]);
        setTitle(data.title);
      } catch (err) {
        if (cancelled || isCanceledError(err)) return;
        if (isNotFoundError(err)) {
          router.replace(libraryHome(libraryId));
          return;
        }
        setLoadError(getApiErrorMessage(err, "We couldn't load this deck."));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deckId, libraryId, router, reloadKey]);

  // --- Save ---
  const flush = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (!dirty.current) return;
    dirty.current = false;
    setSaveStatus("saving");
    void apiPatch(`/api/decks/${deckId}`, { deck: latestDeck.current })
      .then(() => {
        setSaveStatus("saved");
        if (savedTimer.current) clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => setSaveStatus("idle"), 1500);
      })
      .catch(() => setSaveStatus("error"));
  }, [deckId]);

  const mutate = useCallback(
    (next: DeckDoc) => {
      latestDeck.current = next;
      dirty.current = true;
      setDeck(next);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
    },
    [flush]
  );

  useEffect(() => {
    const onBeforeUnload = () => flush();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      flush();
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, [flush]);

  useEffect(() => {
    if (!meta) return;
    setHeader({ saveStatus, titleOverride: title, folderIdFallback: meta.folderId });
  }, [meta, saveStatus, title, setHeader]);

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

  const addElement = useCallback(
    (el: DeckElement) => {
      updateActiveSlide((s) => ({
        ...s,
        elements: { ...s.elements, [el.id]: el },
        elementOrder: [...s.elementOrder.filter((i) => i !== el.id), el.id],
      }));
    },
    [updateActiveSlide]
  );

  const updateElement = useCallback(
    (el: DeckElement) => {
      updateActiveSlide((s) => ({
        ...s,
        elements: { ...s.elements, [el.id]: el },
        elementOrder: s.elementOrder.includes(el.id)
          ? s.elementOrder
          : [...s.elementOrder, el.id],
      }));
    },
    [updateActiveSlide]
  );

  const deleteElement = useCallback(
    (id: string) => {
      updateActiveSlide((s) => {
        const elements = { ...s.elements };
        delete elements[id];
        return { ...s, elements, elementOrder: s.elementOrder.filter((i) => i !== id) };
      });
    },
    [updateActiveSlide]
  );

  const reorderElements = useCallback(
    (order: string[]) => updateActiveSlide((s) => ({ ...s, elementOrder: order })),
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
      setMeta((prev) => (prev ? { ...prev, title: updated.title } : prev));
      setTitle(updated.title);
      refreshTree();
    } catch {
      /* keep local title */
    }
  }, [meta, canEdit, title, refreshTree]);

  const handleExport = useCallback(() => {
    flush();
    const link = document.createElement("a");
    link.href = `/api/decks/${deckId}/export`;
    link.download = `${title || "deck"}.pptx`;
    link.click();
  }, [deckId, title, flush]);

  const activeSlide = deck.slides[activeSlideId];

  const canvas = useMemo(() => {
    if (!meta || !activeSlide) return null;
    return (
      <DeckCanvas
        slide={activeSlide}
        readOnly={readOnly}
        libraryId={meta.libraryId}
        folderId={meta.folderId}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onAddElement={addElement}
        onUpdateElement={updateElement}
        onDeleteElement={deleteElement}
        onReorder={reorderElements}
        onPresent={() => setPresentFrom(deck.slideOrder.indexOf(activeSlideId))}
      />
    );
  }, [
    meta,
    activeSlide,
    readOnly,
    selectedId,
    addElement,
    updateElement,
    deleteElement,
    reorderElements,
    deck.slideOrder,
    activeSlideId,
  ]);

  if (loadError) {
    return (
      <ViewError
        title="Couldn't load this deck"
        message={loadError}
        onRetry={() => setReloadKey((k) => k + 1)}
      />
    );
  }

  if (!meta) {
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
