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

// ---------------------------------------------------------------------------
// Shared design system
//
// Decks read as a single coherent set: clean white content slides, a bold
// accent-colored section divider, and dark cover / quote / closing slides for
// rhythm. The accent is the only thing that changes per template — everything
// else (type scale, margins, dark slate) stays constant so every deck feels
// like it came from the same designer.
// ---------------------------------------------------------------------------

const W = 1280;
const M = 80;
const CONTENT_W = W - M * 2;

const TITLE = "#0f172a";
const BODY = "#334155";
const MUTED = "#64748b";
const HAIRLINE = "#e2e8f0";
const ON_DARK = "#f8fafc";
const ON_DARK_MUTED = "#cbd5e1";
const DARK = "#0f172a";

type SlideTheme = { accent: string };

type Stat = { value: string; label: string };

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

/** Shared header (accent side-bar + title) used by every white content slide. */
function header(title: string, accent: string, size = 48): DeckElement[] {
  return [
    deckRect({ x: M, y: 70, w: 8, h: size + 36, fill: accent, radius: 4 }),
    deckText({
      x: M + 28,
      y: 72,
      w: CONTENT_W - 28,
      h: size + 30,
      text: title,
      fontSize: size,
      fontFamily: "Arial",
      fontWeight: 700,
      color: TITLE,
      align: "left",
    }),
  ];
}

/** Dark cover slide — kicker, big title, subtitle, accent spine. */
function coverSlide(
  theme: SlideTheme,
  kicker: string,
  title: string,
  subtitle: string
): Slide {
  return createSlideFromBuilt({
    background: DARK,
    elements: [
      deckRect({ x: 0, y: 0, w: 12, h: 720, fill: theme.accent }),
      deckText({
        x: M,
        y: 206,
        w: CONTENT_W,
        h: 32,
        text: kicker.toUpperCase(),
        fontSize: 22,
        fontFamily: "Arial",
        fontWeight: 700,
        color: theme.accent,
        align: "left",
      }),
      deckRect({ x: M, y: 250, w: 110, h: 6, fill: theme.accent, radius: 3 }),
      deckText({
        x: M,
        y: 284,
        w: CONTENT_W,
        h: 200,
        text: title,
        fontSize: 84,
        fontFamily: "Arial",
        fontWeight: 700,
        color: ON_DARK,
        align: "left",
      }),
      deckText({
        x: M,
        y: 500,
        w: CONTENT_W - 80,
        h: 80,
        text: subtitle,
        fontSize: 30,
        fontFamily: "Arial",
        color: ON_DARK_MUTED,
        align: "left",
      }),
    ],
  });
}

/** Numbered agenda / overview list. */
function agendaSlide(theme: SlideTheme, title: string, items: string[]): Slide {
  const startY = 210;
  const rowH = Math.min(82, (640 - startY) / Math.max(items.length, 1));
  const rows: DeckElement[] = [];
  items.forEach((item, i) => {
    const y = startY + i * rowH;
    rows.push(
      deckText({
        x: M,
        y,
        w: 64,
        h: rowH,
        text: String(i + 1).padStart(2, "0"),
        fontSize: 34,
        fontFamily: "Arial",
        fontWeight: 700,
        color: theme.accent,
        align: "left",
      }),
      deckText({
        x: M + 92,
        y: y + 4,
        w: CONTENT_W - 92,
        h: rowH,
        text: item,
        fontSize: 30,
        fontFamily: "Arial",
        color: BODY,
        align: "left",
      })
    );
    if (i < items.length - 1) {
      rows.push(
        deckRect({ x: M + 92, y: y + rowH - 14, w: CONTENT_W - 92, h: 2, fill: HAIRLINE, radius: 1 })
      );
    }
  });
  return createSlideFromBuilt({ elements: [...header(title, theme.accent), ...rows] });
}

/** Title + bulleted body. */
function titleContentSlide(theme: SlideTheme, title: string, body: string): Slide {
  return createSlideFromBuilt({
    elements: [
      ...header(title, theme.accent),
      deckText({
        x: M,
        y: 210,
        w: CONTENT_W,
        h: 430,
        text: body,
        fontSize: 30,
        fontFamily: "Arial",
        color: BODY,
        align: "left",
      }),
    ],
  });
}

/** Bold accent-colored section divider. */
function sectionSlide(theme: SlideTheme, kicker: string, title: string): Slide {
  return createSlideFromBuilt({
    background: theme.accent,
    elements: [
      deckText({
        x: M,
        y: 280,
        w: CONTENT_W,
        h: 32,
        text: kicker.toUpperCase(),
        fontSize: 22,
        fontFamily: "Arial",
        fontWeight: 700,
        color: ON_DARK,
        align: "left",
      }),
      deckRect({ x: M, y: 324, w: 90, h: 10, fill: "#ffffff", radius: 4 }),
      deckText({
        x: M,
        y: 350,
        w: CONTENT_W,
        h: 140,
        text: title,
        fontSize: 64,
        fontFamily: "Arial",
        fontWeight: 700,
        color: "#ffffff",
        align: "left",
      }),
    ],
  });
}

/** Big-number metrics row. */
function statsSlide(theme: SlideTheme, title: string, stats: Stat[]): Slide {
  const n = Math.max(stats.length, 1);
  const colW = CONTENT_W / n;
  const cols: DeckElement[] = [];
  stats.forEach((stat, i) => {
    const x = M + i * colW;
    cols.push(
      deckRect({ x: x + colW / 2 - 26, y: 250, w: 52, h: 6, fill: theme.accent, radius: 3 }),
      deckText({
        x,
        y: 286,
        w: colW,
        h: 100,
        text: stat.value,
        fontSize: 76,
        fontFamily: "Arial",
        fontWeight: 700,
        color: theme.accent,
        align: "center",
      }),
      deckText({
        x: x + 20,
        y: 404,
        w: colW - 40,
        h: 80,
        text: stat.label,
        fontSize: 24,
        fontFamily: "Arial",
        color: MUTED,
        align: "center",
      })
    );
  });
  return createSlideFromBuilt({ elements: [...header(title, theme.accent), ...cols] });
}

/** Two side-by-side panels with headings. */
function twoColumnSlide(
  theme: SlideTheme,
  title: string,
  leftHead: string,
  leftBody: string,
  rightHead: string,
  rightBody: string
): Slide {
  const panel = (x: number, heading: string, body: string, soft: string): DeckElement[] => [
    deckRect({ x, y: 196, w: 520, h: 444, fill: soft, radius: 16 }),
    deckText({
      x: x + 32,
      y: 226,
      w: 456,
      h: 44,
      text: heading,
      fontSize: 26,
      fontFamily: "Arial",
      fontWeight: 700,
      color: theme.accent,
      align: "left",
    }),
    deckText({
      x: x + 32,
      y: 288,
      w: 456,
      h: 332,
      text: body,
      fontSize: 26,
      fontFamily: "Arial",
      color: BODY,
      align: "left",
    }),
  ];
  return createSlideFromBuilt({
    elements: [
      ...header(title, theme.accent, 44),
      ...panel(M, leftHead, leftBody, `${theme.accent}14`),
      ...panel(680, rightHead, rightBody, `${theme.accent}0a`),
    ],
  });
}

/** Title + body with an image placeholder. */
function titleImageSlide(
  theme: SlideTheme,
  title: string,
  body: string,
  caption: string
): Slide {
  return createSlideFromBuilt({
    elements: [
      ...header(title, theme.accent, 44),
      deckText({
        x: M,
        y: 200,
        w: 470,
        h: 440,
        text: body,
        fontSize: 28,
        fontFamily: "Arial",
        color: BODY,
        align: "left",
      }),
      deckRect({
        x: 600,
        y: 196,
        w: 600,
        h: 444,
        fill: `${theme.accent}12`,
        stroke: theme.accent,
        strokeWidth: 2,
        radius: 16,
      }),
      deckText({
        x: 600,
        y: 404,
        w: 600,
        h: 40,
        text: caption,
        fontSize: 22,
        fontFamily: "Arial",
        color: theme.accent,
        align: "center",
      }),
    ],
  });
}

/** Dark full-bleed pull quote. */
function quoteSlide(theme: SlideTheme, quote: string, attribution: string): Slide {
  return createSlideFromBuilt({
    background: DARK,
    elements: [
      deckText({
        x: M - 6,
        y: 120,
        w: 200,
        h: 160,
        text: "\u201C",
        fontSize: 200,
        fontFamily: "Arial",
        fontWeight: 700,
        color: theme.accent,
        align: "left",
      }),
      deckText({
        x: M,
        y: 290,
        w: CONTENT_W,
        h: 260,
        text: quote,
        fontSize: 46,
        fontFamily: "Arial",
        fontWeight: 700,
        color: ON_DARK,
        align: "left",
      }),
      deckText({
        x: M,
        y: 566,
        w: CONTENT_W,
        h: 40,
        text: `\u2014 ${attribution}`,
        fontSize: 26,
        fontFamily: "Arial",
        color: theme.accent,
        align: "left",
      }),
    ],
  });
}

/** Dark closing slide (mirrors the cover). */
function closingSlide(theme: SlideTheme, title: string, subtitle: string): Slide {
  return createSlideFromBuilt({
    background: DARK,
    elements: [
      deckRect({ x: 0, y: 0, w: 12, h: 720, fill: theme.accent }),
      deckRect({ x: M, y: 272, w: 110, h: 6, fill: theme.accent, radius: 3 }),
      deckText({
        x: M,
        y: 300,
        w: CONTENT_W,
        h: 150,
        text: title,
        fontSize: 76,
        fontFamily: "Arial",
        fontWeight: 700,
        color: ON_DARK,
        align: "left",
      }),
      deckText({
        x: M,
        y: 470,
        w: CONTENT_W,
        h: 60,
        text: subtitle,
        fontSize: 30,
        fontFamily: "Arial",
        color: ON_DARK_MUTED,
        align: "left",
      }),
    ],
  });
}

export type PresentationTemplate = {
  id: string;
  label: string;
  title: string;
  description: string;
  build: () => Slide[];
};

const PITCH: SlideTheme = { accent: "#4f46e5" };
const UPDATE: SlideTheme = { accent: "#0d9488" };
const LESSON: SlideTheme = { accent: "#9333ea" };
const STORY: SlideTheme = { accent: "#ea580c" };

/** Full multi-slide presentation starters for the Slides home page. */
export const PRESENTATION_TEMPLATES: PresentationTemplate[] = [
  {
    id: "pitch",
    label: "Pitch deck",
    title: "Pitch deck",
    description: "12-slide investor narrative: problem, solution, traction, and the ask.",
    build: () => [
      coverSlide(PITCH, "Pitch deck · 2026", "Acme", "Reimagining how teams capture and recall knowledge"),
      agendaSlide(PITCH, "Agenda", [
        "The problem",
        "Our solution",
        "How it works",
        "Why now",
        "Traction",
        "The ask",
      ]),
      titleContentSlide(
        PITCH,
        "The problem",
        "• Knowledge lives in scattered docs, chats, and people's heads\n• Onboarding drags on because context is impossible to find\n• Decisions get re-litigated — nobody remembers the why\n• Search returns files, not answers",
      ),
      titleContentSlide(
        PITCH,
        "Why it matters now",
        "• Teams ship slower when every answer is a Slack archaeology dig\n• Tool sprawl means the same idea lives in five half-updated places\n• New hires take months to reach full context\n• Every lost decision is rework waiting to happen",
      ),
      sectionSlide(PITCH, "What we built", "Our solution"),
      titleContentSlide(
        PITCH,
        "One workspace, total recall",
        "• Docs, boards, databases, and slides in a single place\n• AI recall that answers from your team's actual work\n• Templates and structure so good habits stick\n• Fast enough that people reach for it every day",
      ),
      twoColumnSlide(
        PITCH,
        "Why now & why us",
        "Why now",
        "• Remote work made written context essential\n• AI finally made semantic recall practical\n• Buyers are consolidating tool sprawl\n• Appetite for fewer, deeper tools",
        "Why us",
        "• Founders shipped knowledge tools at scale\n• Design-first UX, not another cluttered wiki\n• Native types for every kind of work\n• A recall layer competitors don't have",
      ),
      statsSlide(PITCH, "Early traction", [
        { value: "40+", label: "design partners across product & eng" },
        { value: "68%", label: "weekly active after 30 days" },
        { value: "52", label: "NPS from the early cohort" },
        { value: "$1.2M", label: "qualified pipeline" },
      ]),
      titleImageSlide(
        PITCH,
        "See it in action",
        "• Capture once, recall anywhere\n• Ask a question, get a cited answer\n• Every native type, one consistent home\n• Built for speed on day one",
        "Product screenshot",
      ),
      quoteSlide(
        PITCH,
        "Acme replaced three tools and finally made our decisions searchable.",
        "Head of Product, design partner",
      ),
      closingSlide(PITCH, "Let's talk", "you@acme.com · acme.com"),
    ],
  },
  {
    id: "project-update",
    label: "Project update",
    title: "Project update",
    description: "Status deck with highlights, metrics, risks, and decisions needed.",
    build: () => [
      coverSlide(UPDATE, "Project update", "Q2 Platform Update", "Platform team · June 2026"),
      agendaSlide(UPDATE, "What we'll cover", [
        "Highlights",
        "By the numbers",
        "In progress",
        "Risks & blockers",
        "Decisions needed",
        "Next steps",
      ]),
      titleContentSlide(
        UPDATE,
        "Highlights",
        "• Shipped native home pages for docs, slides, and boards\n• Cut time-to-first-doc from 4 min to under 90 sec\n• Recents now work across every library\n• Template gallery live on each native app home",
      ),
      statsSlide(UPDATE, "By the numbers", [
        { value: "90s", label: "time to first doc" },
        { value: "+34%", label: "weekly active users" },
        { value: "4", label: "native types shipped" },
        { value: "20", label: "beta teams onboarded" },
      ]),
      sectionSlide(UPDATE, "Heads up", "Risks & blockers"),
      twoColumnSlide(
        UPDATE,
        "The plan",
        "This week",
        "• Finish the standalone editor shell\n• Polish template thumbnails\n• Mobile layout pass on home pages\n• Write the library-URL migration guide",
        "Next week",
        "• Beta invite to 20 more teams\n• Performance audit on the recents query\n• Ship the keyboard-shortcuts doc\n• Start billing-integration QA",
      ),
      titleContentSlide(
        UPDATE,
        "Decisions needed",
        "• Keep mind-map as a native type, or fold it into boards?\n• Default library for new users — personal or team?\n• Launch: July 1 soft launch vs July 15 with billing\n\nOwner: @alex · review by Friday standup",
      ),
      closingSlide(UPDATE, "Questions?", "#platform-team · notes are in this deck"),
    ],
  },
  {
    id: "lesson",
    label: "Lesson",
    title: "Lesson",
    description: "Teaching deck with objectives, do/don't columns, and takeaways.",
    build: () => [
      coverSlide(LESSON, "Lesson", "Intro to Product Discovery", "A practical guide for builders"),
      sectionSlide(LESSON, "Before we start", "Learning objectives"),
      titleContentSlide(
        LESSON,
        "By the end of this session",
        "• Frame a problem before jumping to solutions\n• Run lightweight interviews that surface real needs\n• Synthesize findings into testable assumptions\n• Know when you have enough signal to build",
      ),
      titleContentSlide(
        LESSON,
        "What discovery actually is",
        "• A continuous habit, not a phase you finish\n• Reducing risk before you write code\n• Listening for problems, not validating features\n• Cheap experiments that change your mind quickly",
      ),
      titleImageSlide(
        LESSON,
        "Talk to users early",
        "• 5–8 interviews beat 50 survey responses\n• Ask about past behavior, not hypotheticals\n• Capture notes in a shared doc the same day\n• Look for patterns, not hero quotes",
        "Interview session",
      ),
      twoColumnSlide(
        LESSON,
        "Do & don't",
        "Do",
        "• Open with broad, curious questions\n• Let silence do the work\n• Dig into specific recent examples\n• Share raw clips with the team",
        "Don't",
        "• Pitch your solution mid-interview\n• Ask leading yes/no questions\n• Rely on a single loud opinion\n• Wait a week to write notes",
      ),
      quoteSlide(
        LESSON,
        "Fall in love with the problem, not your solution.",
        "A discovery mantra worth repeating",
      ),
      titleContentSlide(
        LESSON,
        "Key takeaways",
        "• Discovery is a habit, not a milestone\n• Write assumptions down so you can disprove them\n• Share quotes and clips with the whole team\n• Small experiments beat big bets without evidence",
      ),
      closingSlide(LESSON, "Keep practicing", "Slides + worksheet in the shared folder"),
    ],
  },
  {
    id: "photo-story",
    label: "Photo story",
    title: "Photo story",
    description: "Event recap with day-by-day story slides and highlight stats.",
    build: () => [
      coverSlide(STORY, "Photo story", "Summer Retreat 2026", "Lake Tahoe · June 12–14"),
      titleImageSlide(
        STORY,
        "Day one — arrival",
        "• Team landed by 2pm, cabins assigned\n• Welcome circle: one Q2 win each\n• Sunset hike to Eagle Point\n• Tacos and s'mores by the fire",
        "Sunset hike",
      ),
      titleImageSlide(
        STORY,
        "Day two — build & play",
        "• Morning hackathon: best internal tool in 3 hours\n• Afternoon kayak relay (engineering won)\n• Awards: most helpful, best demo, funniest bug\n• Stargazing after lights out",
        "Kayak relay",
      ),
      statsSlide(STORY, "The retreat in numbers", [
        { value: "3", label: "days off-site" },
        { value: "24", label: "teammates" },
        { value: "6", label: "sessions run" },
        { value: "1", label: "winning team" },
      ]),
      sectionSlide(STORY, "Look back", "Memories"),
      titleImageSlide(
        STORY,
        "Highlights reel",
        "• The whiteboard that became the roadmap\n• A surprise birthday at dinner\n• The lake swim nobody planned\n• Group photo at golden hour",
        "Group photo",
      ),
      closingSlide(STORY, "See you next year", "#retreat-2026 · album link inside"),
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
  return slides[0] ?? coverSlide(PITCH, "Presentation", "Presentation", "Subtitle");
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
