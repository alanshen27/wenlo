// Slideshow (deck) scene model. Each slide holds a shared scene element map.

import type { CoreElement, DeckElement, ShapeKind, TextAlign } from "@/lib/scene/elements";
import {
  DECK_HEIGHT,
  DECK_WIDTH,
  DEFAULT_SLIDE_BG,
} from "@/lib/scene/scene-config";
import { newSceneId, normalizeScene } from "@/lib/scene/scene-schema";

export type { DeckElement, ShapeKind, TextAlign };
export { DECK_WIDTH, DECK_HEIGHT, DEFAULT_SLIDE_BG };

export const DECK_VERSION = 1 as const;

export type ElementBase = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  opacity?: number;
};

export type TextElement = Extract<CoreElement, { type: "text" }>;
export type ImageElement = Extract<CoreElement, { type: "image" }>;
export type ShapeElement = Extract<CoreElement, { type: "shape" }>;

export type DeckElementType = DeckElement["type"];

export type Slide = {
  id: string;
  background?: string;
  elementOrder: string[];
  elements: Record<string, DeckElement>;
};

export type DeckTheme = {
  background?: string;
  fontFamily?: string;
};

export type DeckDoc = {
  version: typeof DECK_VERSION;
  size: { w: number; h: number };
  slideOrder: string[];
  slides: Record<string, Slide>;
  theme?: DeckTheme;
};

export const newDeckId = newSceneId;

export function createEmptySlide(id = newDeckId("sl")): Slide {
  return { id, background: DEFAULT_SLIDE_BG, elementOrder: [], elements: {} };
}

export function createEmptyDeck(): DeckDoc {
  const slide = createEmptySlide();
  return {
    version: DECK_VERSION,
    size: { w: DECK_WIDTH, h: DECK_HEIGHT },
    slideOrder: [slide.id],
    slides: { [slide.id]: slide },
    theme: { background: DEFAULT_SLIDE_BG, fontFamily: "Arial" },
  };
}

function normalizeSlide(input: unknown, fallbackId: string): Slide {
  if (!input || typeof input !== "object") return createEmptySlide(fallbackId);
  const raw = input as Partial<Slide>;
  const scene = normalizeScene({
    elementOrder: raw.elementOrder,
    elements: raw.elements,
  });

  return {
    id: typeof raw.id === "string" ? raw.id : fallbackId,
    background: typeof raw.background === "string" ? raw.background : DEFAULT_SLIDE_BG,
    elementOrder: scene.elementOrder,
    elements: scene.elements as Record<string, DeckElement>,
  };
}

export function normalizeDeck(input: unknown): DeckDoc {
  if (!input || typeof input !== "object") return createEmptyDeck();
  const raw = input as Partial<DeckDoc>;

  const rawSlides =
    raw.slides && typeof raw.slides === "object"
      ? (raw.slides as Record<string, unknown>)
      : {};

  const slides: Record<string, Slide> = {};
  for (const [id, value] of Object.entries(rawSlides)) {
    slides[id] = normalizeSlide(value, id);
  }

  let order = Array.isArray(raw.slideOrder)
    ? raw.slideOrder.filter((id) => id in slides)
    : [];
  for (const id of Object.keys(slides)) {
    if (!order.includes(id)) order.push(id);
  }

  if (order.length === 0) {
    const slide = createEmptySlide();
    slides[slide.id] = slide;
    order = [slide.id];
  }

  return {
    version: DECK_VERSION,
    size: {
      w: raw.size?.w ?? DECK_WIDTH,
      h: raw.size?.h ?? DECK_HEIGHT,
    },
    slideOrder: order,
    slides,
    theme: {
      background: raw.theme?.background ?? DEFAULT_SLIDE_BG,
      fontFamily: raw.theme?.fontFamily ?? "Arial",
    },
  };
}

export function deriveDeckText(deck: DeckDoc): string {
  const parts: string[] = [];
  for (const slideId of deck.slideOrder) {
    const slide = deck.slides[slideId];
    if (!slide) continue;
    for (const elId of slide.elementOrder) {
      const el = slide.elements[elId];
      if (el && el.type === "text") {
        const text = el.text?.trim();
        if (text) parts.push(text);
      }
    }
  }
  return parts.join("\n");
}
