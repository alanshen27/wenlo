import { createSlideFromTemplate } from "@/lib/decks/deck-templates";
import {
  DECK_HEIGHT,
  DECK_VERSION,
  DECK_WIDTH,
  DEFAULT_SLIDE_BG,
  type DeckDoc,
  type Slide,
} from "@/lib/decks/deck-schema";

export type PresentationTemplate = {
  id: string;
  label: string;
  title: string;
  /** Slide layout ids in order — each becomes one slide in the deck. */
  slides: string[];
};

/** Full multi-slide presentation starters for the Slides home page. */
export const PRESENTATION_TEMPLATES: PresentationTemplate[] = [
  {
    id: "pitch",
    label: "Pitch deck",
    title: "Pitch deck",
    slides: ["title", "title-content", "title-content", "section", "two-content", "title"],
  },
  {
    id: "project-update",
    label: "Project update",
    title: "Project update",
    slides: ["title", "title-content", "section", "title-content", "two-content"],
  },
  {
    id: "lesson",
    label: "Lesson",
    title: "Lesson",
    slides: ["title", "section", "title-content", "title-image", "title-content"],
  },
  {
    id: "photo-story",
    label: "Photo story",
    title: "Photo story",
    slides: ["title", "title-image", "title-image", "section", "title"],
  },
];

export function getPresentationTemplate(id: string) {
  return PRESENTATION_TEMPLATES.find((t) => t.id === id) ?? PRESENTATION_TEMPLATES[0];
}

/** Compose a full DeckDoc from a presentation template id. */
export function createPresentationFromTemplate(id: string): DeckDoc {
  const template = getPresentationTemplate(id);
  const slides = template.slides.map((layoutId) => createSlideFromTemplate(layoutId));
  return deckFromSlides(slides);
}

/** First slide — used for template card thumbnails. */
export function presentationThumbnailSlide(id: string): Slide {
  const template = getPresentationTemplate(id);
  const layoutId = template.slides[0] ?? "title";
  return createSlideFromTemplate(layoutId);
}

function deckFromSlides(slides: Slide[]): DeckDoc {
  const slideOrder = slides.map((s) => s.id);
  const slidesMap = Object.fromEntries(slides.map((s) => [s.id, s]));
  return {
    version: DECK_VERSION,
    size: { w: DECK_WIDTH, h: DECK_HEIGHT },
    slideOrder,
    slides: slidesMap,
    theme: { background: DEFAULT_SLIDE_BG, fontFamily: "Arial" },
  };
}
