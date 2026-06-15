import { createSlideFromBuilt } from "@/lib/decks/deck-templates";
import {
  DECK_HEIGHT,
  DECK_VERSION,
  DECK_WIDTH,
  DEFAULT_SLIDE_BG,
  newDeckId,
  type DeckDoc,
  type DeckElement,
  type Slide,
} from "@/lib/decks/deck-schema";

const TITLE = "#1f2937";
const BODY = "#374151";
const MUTED = "#6b7280";
const ACCENT = "#f97316";
const PLACEHOLDER_FILL = "#e5e7eb";
const PLACEHOLDER_STROKE = "#9ca3af";
const M = 80;
const CONTENT_W = 1280 - M * 2;

function deckText(
  partial: Omit<Extract<DeckElement, { type: "text" }>, "id" | "type">
): DeckElement {
  return { id: newDeckId(), type: "text", ...partial };
}

function deckRect(
  partial: Omit<Extract<DeckElement, { type: "shape" }>, "id" | "type" | "shape">
): DeckElement {
  return { id: newDeckId(), type: "shape", shape: "rect", ...partial };
}

function titleSlide(title: string, subtitle: string): Slide {
  return createSlideFromBuilt({
    elements: [
      deckText({
        x: M,
        y: 250,
        w: CONTENT_W,
        h: 150,
        text: title,
        fontSize: 72,
        fontFamily: "Arial",
        fontWeight: 700,
        color: TITLE,
        align: "center",
      }),
      deckText({
        x: M,
        y: 410,
        w: CONTENT_W,
        h: 60,
        text: subtitle,
        fontSize: 32,
        fontFamily: "Arial",
        color: MUTED,
        align: "center",
      }),
    ],
  });
}

function titleContentSlide(title: string, body: string): Slide {
  return createSlideFromBuilt({
    elements: [
      deckText({
        x: M,
        y: 64,
        w: CONTENT_W,
        h: 90,
        text: title,
        fontSize: 48,
        fontFamily: "Arial",
        fontWeight: 700,
        color: TITLE,
        align: "left",
      }),
      deckText({
        x: M,
        y: 190,
        w: CONTENT_W,
        h: 440,
        text: body,
        fontSize: 30,
        fontFamily: "Arial",
        color: BODY,
        align: "left",
      }),
    ],
  });
}

function sectionSlide(title: string): Slide {
  return createSlideFromBuilt({
    background: "#1f2937",
    elements: [
      deckRect({ x: M, y: 318, w: 90, h: 10, fill: ACCENT, radius: 4 }),
      deckText({
        x: M,
        y: 344,
        w: CONTENT_W,
        h: 130,
        text: title,
        fontSize: 60,
        fontFamily: "Arial",
        fontWeight: 700,
        color: "#ffffff",
        align: "left",
      }),
    ],
  });
}

function twoColumnSlide(title: string, left: string, right: string): Slide {
  return createSlideFromBuilt({
    elements: [
      deckText({
        x: M,
        y: 64,
        w: CONTENT_W,
        h: 80,
        text: title,
        fontSize: 44,
        fontFamily: "Arial",
        fontWeight: 700,
        color: TITLE,
        align: "left",
      }),
      deckText({
        x: M,
        y: 190,
        w: 520,
        h: 440,
        text: left,
        fontSize: 28,
        fontFamily: "Arial",
        color: BODY,
        align: "left",
      }),
      deckText({
        x: 680,
        y: 190,
        w: 520,
        h: 440,
        text: right,
        fontSize: 28,
        fontFamily: "Arial",
        color: BODY,
        align: "left",
      }),
    ],
  });
}

function titleImageSlide(title: string, body: string, imageCaption = "Add an image here"): Slide {
  return createSlideFromBuilt({
    elements: [
      deckText({
        x: M,
        y: 64,
        w: CONTENT_W,
        h: 80,
        text: title,
        fontSize: 44,
        fontFamily: "Arial",
        fontWeight: 700,
        color: TITLE,
        align: "left",
      }),
      deckText({
        x: M,
        y: 190,
        w: 480,
        h: 440,
        text: body,
        fontSize: 28,
        fontFamily: "Arial",
        color: BODY,
        align: "left",
      }),
      deckRect({
        x: 620,
        y: 190,
        w: 580,
        h: 420,
        fill: PLACEHOLDER_FILL,
        stroke: PLACEHOLDER_STROKE,
        strokeWidth: 2,
        radius: 12,
      }),
      deckText({
        x: 620,
        y: 380,
        w: 580,
        h: 40,
        text: imageCaption,
        fontSize: 24,
        fontFamily: "Arial",
        color: MUTED,
        align: "center",
      }),
    ],
  });
}

export type PresentationTemplate = {
  id: string;
  label: string;
  title: string;
  build: () => Slide[];
};

/** Full multi-slide presentation starters for the Slides home page. */
export const PRESENTATION_TEMPLATES: PresentationTemplate[] = [
  {
    id: "pitch",
    label: "Pitch deck",
    title: "Pitch deck",
    build: () => [
      titleSlide("Acme", "Reimagining how teams capture and recall knowledge"),
      titleContentSlide(
        "The problem",
        "• Knowledge lives in scattered docs, chats, and people's heads\n• Onboarding takes weeks because context is hard to find\n• Decisions get re-litigated because nobody remembers why\n• Search surfaces files, not answers"
      ),
      titleContentSlide(
        "Our solution",
        "• One workspace for docs, boards, databases, and slides\n• AI recall that answers from your team's actual work\n• Templates and structure so good habits stick\n• Fast enough that people actually use it every day"
      ),
      sectionSlide("Market opportunity"),
      twoColumnSlide(
        "Why now",
        "Why now\n\n• Remote work made written context essential\n• AI made semantic search practical\n• Teams are consolidating tool sprawl\n• Buyers want fewer vendors, not more",
        "Why us\n\n• Founders shipped knowledge tools at scale\n• Design-first UX — not another cluttered wiki\n• Native types for every kind of work\n• Recall layer competitors don't have"
      ),
      titleContentSlide(
        "Traction",
        "• 40+ design partners across product & eng teams\n• 68% weekly active after 30 days\n• NPS 52 from early cohort\n• Pipeline: $1.2M ARR in qualified conversations"
      ),
      titleSlide("Let's talk", "you@acme.com · acme.com"),
    ],
  },
  {
    id: "project-update",
    label: "Project update",
    title: "Project update",
    build: () => [
      titleSlide("Q2 project update", "Platform team · June 2026"),
      titleContentSlide(
        "Highlights",
        "• Shipped native home pages for docs, slides, and boards\n• Cut time-to-first-doc from 4 min to under 90 sec\n• Recents API now works across libraries\n• Template gallery live on every native app home"
      ),
      sectionSlide("Risks & blockers"),
      twoColumnSlide(
        "This week",
        "• Finish standalone editor shell for all types\n• Polish template thumbnails\n• Mobile layout pass on home pages\n• Write migration guide for library URLs",
        "Next week\n\n• Beta invite to 20 more teams\n• Performance audit on recents query\n• Ship keyboard shortcuts doc\n• Start billing integration QA"
      ),
      titleContentSlide(
        "Decisions needed",
        "• Do we keep mind-map as a native type or fold into boards?\n• Default library for new users — personal or team?\n• Launch date: July 1 soft launch vs July 15 with billing\n\nOwner: @alex · Review by Friday standup"
      ),
    ],
  },
  {
    id: "lesson",
    label: "Lesson",
    title: "Lesson",
    build: () => [
      titleSlide("Intro to product discovery", "A practical guide for builders"),
      sectionSlide("Learning objectives"),
      titleContentSlide(
        "By the end of this session",
        "• Frame a problem before jumping to solutions\n• Run lightweight interviews that surface real needs\n• Synthesize findings into testable assumptions\n• Know when you have enough signal to build"
      ),
      titleImageSlide(
        "Talk to users early",
        "• 5–8 interviews beat 50 survey responses\n• Ask about past behavior, not hypotheticals\n• Record notes in a shared doc same day\n• Look for patterns across interviews, not hero quotes",
        "Photo: interview session"
      ),
      titleContentSlide(
        "Key takeaways",
        "• Discovery is a habit, not a phase you finish\n• Write assumptions down so you can disprove them\n• Share clips and quotes with the whole team\n• Small experiments > big bets without evidence"
      ),
    ],
  },
  {
    id: "photo-story",
    label: "Photo story",
    title: "Photo story",
    build: () => [
      titleSlide("Summer retreat 2026", "Lake Tahoe · June 12–14"),
      titleImageSlide(
        "Day one — arrival",
        "• Team landed by 2pm, cabins assigned\n• Welcome circle: one win from Q2 each\n• Sunset hike to Eagle Point\n• Dinner: tacos + s'mores by the fire",
        "Photo: sunset hike"
      ),
      titleImageSlide(
        "Day two — build & play",
        "• Morning hackathon: best internal tool in 3 hours\n• Afternoon kayak relay (engineering won)\n• Awards: most helpful, best demo, funniest bug story\n• Stargazing after lights out",
        "Photo: kayak relay"
      ),
      sectionSlide("Memories"),
      titleSlide("See you next year", "#retreat-2026 · group album link"),
    ],
  },
];

export function getPresentationTemplate(id: string) {
  return PRESENTATION_TEMPLATES.find((t) => t.id === id) ?? PRESENTATION_TEMPLATES[0];
}

/** Compose a full DeckDoc from a presentation template id. */
export function createPresentationFromTemplate(id: string): DeckDoc {
  const template = getPresentationTemplate(id);
  return deckFromSlides(template.build());
}

/** First slide — used for template card thumbnails. */
export function presentationThumbnailSlide(id: string): Slide {
  const template = getPresentationTemplate(id);
  const slides = template.build();
  return slides[0] ?? titleSlide("Presentation", "Subtitle");
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
