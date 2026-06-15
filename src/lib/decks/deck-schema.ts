// Slideshow (deck) scene model. A deck is an ordered set of fixed-size slides,
// each holding a flat, id-keyed map of elements plus a separate z-order array.
// The shape is intentionally collaboration-friendly (flat maps + stable ids +
// no nested arrays-of-primitives) so a Yjs binding can drop in later:
// Y.Array<slideId> + Y.Map per slide + Y.Map per element.

import type { ShapeKind } from "@/lib/canvas/shapes";

export type { ShapeKind };

export const DECK_VERSION = 1 as const;

/** Fixed 16:9 canvas. Element coordinates are always in this space; the editor
 *  and present mode only scale the stage, never the coordinates. */
export const DECK_WIDTH = 1280;
export const DECK_HEIGHT = 720;
export const DEFAULT_SLIDE_BG = "#ffffff";

export type ElementBase = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  opacity?: number;
};

export type TextAlign = "left" | "center" | "right";

export type TextElement = ElementBase & {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight?: number;
  italic?: boolean;
  color: string;
  align?: TextAlign;
};

export type ImageElement = ElementBase & {
  type: "image";
  src: string;
  documentId?: string;
};

export type ShapeElement = ElementBase & {
  type: "shape";
  shape: ShapeKind;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
};

export type DeckElement = TextElement | ImageElement | ShapeElement;
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

export function newDeckId(prefix = "el"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

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
  const elements: Record<string, DeckElement> =
    raw.elements && typeof raw.elements === "object"
      ? (raw.elements as Record<string, DeckElement>)
      : {};

  const order = Array.isArray(raw.elementOrder)
    ? raw.elementOrder.filter((id) => id in elements)
    : [];
  for (const id of Object.keys(elements)) {
    if (!order.includes(id)) order.push(id);
  }

  return {
    id: typeof raw.id === "string" ? raw.id : fallbackId,
    background: typeof raw.background === "string" ? raw.background : DEFAULT_SLIDE_BG,
    elementOrder: order,
    elements,
  };
}

/** Coerces unknown JSON (or null) into a valid, well-ordered DeckDoc. */
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

  // A deck always has at least one slide so the editor never renders empty.
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

/** Concatenated text from every text element across slides, for search indexing. */
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
