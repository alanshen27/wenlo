import {
  createEmptySlide,
  newDeckId,
  type DeckElement,
  type Slide,
} from "@/lib/decks/deck-schema";

// Shared palette + layout metrics so templates read consistently.
const TITLE = "#1f2937";
const BODY = "#374151";
const MUTED = "#6b7280";
const ACCENT = "#f97316";
const PLACEHOLDER_FILL = "#e5e7eb";
const PLACEHOLDER_STROKE = "#9ca3af";
const M = 80; // page margin
const CONTENT_W = 1280 - M * 2;

type Built = { background?: string; elements: DeckElement[] };

export type SlideTemplate = {
  id: string;
  label: string;
  build: () => Built;
};

function text(partial: Omit<Extract<DeckElement, { type: "text" }>, "id" | "type">): DeckElement {
  return { id: newDeckId(), type: "text", ...partial };
}

function rect(partial: Omit<Extract<DeckElement, { type: "shape" }>, "id" | "type" | "shape">): DeckElement {
  return { id: newDeckId(), type: "shape", shape: "rect", ...partial };
}

export const SLIDE_TEMPLATES: SlideTemplate[] = [
  {
    id: "blank",
    label: "Blank",
    build: () => ({ elements: [] }),
  },
  {
    id: "title",
    label: "Title",
    build: () => ({
      elements: [
        text({
          x: M,
          y: 250,
          w: CONTENT_W,
          h: 150,
          text: "Presentation title",
          fontSize: 72,
          fontFamily: "Arial",
          fontWeight: 700,
          color: TITLE,
          align: "center",
        }),
        text({
          x: M,
          y: 410,
          w: CONTENT_W,
          h: 60,
          text: "Subtitle or author name",
          fontSize: 32,
          fontFamily: "Arial",
          color: MUTED,
          align: "center",
        }),
      ],
    }),
  },
  {
    id: "title-content",
    label: "Title & content",
    build: () => ({
      elements: [
        text({
          x: M,
          y: 64,
          w: CONTENT_W,
          h: 90,
          text: "Slide title",
          fontSize: 48,
          fontFamily: "Arial",
          fontWeight: 700,
          color: TITLE,
          align: "left",
        }),
        text({
          x: M,
          y: 190,
          w: CONTENT_W,
          h: 440,
          text: "• First point\n• Second point\n• Third point",
          fontSize: 30,
          fontFamily: "Arial",
          color: BODY,
          align: "left",
        }),
      ],
    }),
  },
  {
    id: "section",
    label: "Section header",
    build: () => ({
      background: "#1f2937",
      elements: [
        rect({ x: M, y: 318, w: 90, h: 10, fill: ACCENT, radius: 4 }),
        text({
          x: M,
          y: 344,
          w: CONTENT_W,
          h: 130,
          text: "Section title",
          fontSize: 60,
          fontFamily: "Arial",
          fontWeight: 700,
          color: "#ffffff",
          align: "left",
        }),
      ],
    }),
  },
  {
    id: "two-content",
    label: "Two columns",
    build: () => ({
      elements: [
        text({
          x: M,
          y: 64,
          w: CONTENT_W,
          h: 80,
          text: "Slide title",
          fontSize: 44,
          fontFamily: "Arial",
          fontWeight: 700,
          color: TITLE,
          align: "left",
        }),
        text({
          x: M,
          y: 190,
          w: 520,
          h: 440,
          text: "• Point one\n• Point two\n• Point three",
          fontSize: 28,
          fontFamily: "Arial",
          color: BODY,
          align: "left",
        }),
        text({
          x: 680,
          y: 190,
          w: 520,
          h: 440,
          text: "• Point one\n• Point two\n• Point three",
          fontSize: 28,
          fontFamily: "Arial",
          color: BODY,
          align: "left",
        }),
      ],
    }),
  },
  {
    id: "title-image",
    label: "Title & image",
    build: () => ({
      elements: [
        text({
          x: M,
          y: 64,
          w: CONTENT_W,
          h: 80,
          text: "Slide title",
          fontSize: 44,
          fontFamily: "Arial",
          fontWeight: 700,
          color: TITLE,
          align: "left",
        }),
        text({
          x: M,
          y: 190,
          w: 480,
          h: 440,
          text: "• First point\n• Second point\n• Third point",
          fontSize: 28,
          fontFamily: "Arial",
          color: BODY,
          align: "left",
        }),
        rect({
          x: 620,
          y: 190,
          w: 580,
          h: 420,
          fill: PLACEHOLDER_FILL,
          stroke: PLACEHOLDER_STROKE,
          strokeWidth: 2,
          radius: 12,
        }),
        text({
          x: 620,
          y: 380,
          w: 580,
          h: 40,
          text: "Add an image here",
          fontSize: 24,
          fontFamily: "Arial",
          color: MUTED,
          align: "center",
        }),
      ],
    }),
  },
];

export function getSlideTemplate(id: string | undefined): SlideTemplate {
  return SLIDE_TEMPLATES.find((t) => t.id === id) ?? SLIDE_TEMPLATES[0];
}

/** Builds a fresh Slide (new ids) from a template id. */
export function createSlideFromTemplate(id?: string): Slide {
  const slide = createEmptySlide();
  const { background, elements } = getSlideTemplate(id).build();
  const map: Record<string, DeckElement> = {};
  const order: string[] = [];
  for (const el of elements) {
    map[el.id] = el;
    order.push(el.id);
  }
  return {
    ...slide,
    background: background ?? slide.background,
    elements: map,
    elementOrder: order,
  };
}
