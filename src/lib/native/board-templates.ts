import { type BoardDoc } from "@/lib/boards/board-schema";

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `el-${Math.random().toString(36).slice(2)}`;
}

export type BoardTemplate = {
  id: string;
  label: string;
  title: string;
  description: string;
  build: () => BoardDoc;
};

function columnBg(x: number, y: number, w: number, h: number, fill: string) {
  const id = newId();
  return {
    id,
    type: "shape" as const,
    shape: "rect" as const,
    x,
    y,
    w,
    h,
    fill,
    stroke: "transparent",
    strokeWidth: 0,
  };
}
function label(x: number, y: number, text: string, color = "#64748b") {
  const id = newId();
  const fontSize = 22;
  return {
    id,
    type: "text" as const,
    x,
    y,
    w: 200,
    h: fontSize * 1.4,
    text,
    fontSize,
    color,
  };
}

function sticky(x: number, y: number, text: string, fill: string, w = 180, h = 120) {
  const id = newId();
  return {
    id,
    type: "sticky" as const,
    x,
    y,
    w,
    h,
    text,
    fill,
    color: "#1f2937",
  };
}

export const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    id: "brainstorm",
    label: "Brainstorm",
    title: "Brainstorm",
    description: "Yellow canvas with seven color-coded idea stickies ready to sort.",
    build: () => {
      const canvas = columnBg(0, 0, 780, 560, "#fffbeb");
      const title = label(80, 24, "Brainstorm — Q3 feature ideas", "#b45309");
      const s1 = sticky(60, 80, "AI summary across libraries", "#fef08a");
      const s2 = sticky(280, 60, "Shared templates marketplace", "#bfdbfe");
      const s3 = sticky(500, 90, "Offline mode for docs", "#bbf7d0");
      const s4 = sticky(120, 230, "Comments on whiteboards", "#fbcfe8");
      const s5 = sticky(340, 250, "Calendar view for databases", "#fde68a");
      const s6 = sticky(560, 220, "Public read-only links", "#ddd6fe");
      const s7 = sticky(200, 400, "Keyboard shortcut cheatsheet", "#fecdd3");
      return {
        version: 2,
        elements: {
          [canvas.id]: canvas,
          [title.id]: title,
          [s1.id]: s1,
          [s2.id]: s2,
          [s3.id]: s3,
          [s4.id]: s4,
          [s5.id]: s5,
          [s6.id]: s6,
          [s7.id]: s7,
        },
        elementOrder: [canvas.id, title.id, s1.id, s2.id, s3.id, s4.id, s5.id, s6.id, s7.id],
      };
    },
  },
  {
    id: "retro",
    label: "Retro board",
    title: "Retro",
    description: "Three columns: went well, to improve, and concrete action items.",
    build: () => {
      const col1 = columnBg(20, 56, 230, 420, "#ecfdf5");
      const col2 = columnBg(270, 56, 230, 420, "#fffbeb");
      const col3 = columnBg(520, 56, 230, 420, "#eff6ff");
      const h1 = label(60, 24, "Went well", "#059669");
      const h2 = label(320, 24, "To improve", "#d97706");
      const h3 = label(580, 24, "Action items", "#2563eb");
      const g1 = sticky(40, 70, "Native homes shipped on time", "#bbf7d0");
      const g2 = sticky(40, 210, "Great pairing on recents API", "#bbf7d0");
      const g3 = sticky(40, 350, "Beta users love the launcher", "#bbf7d0");
      const i1 = sticky(300, 70, "Template quality was thin at launch", "#fef08a");
      const i2 = sticky(300, 210, "Too many parallel refactors", "#fef08a");
      const i3 = sticky(300, 350, "Docs for new routes missing", "#fef08a");
      const a1 = sticky(560, 70, "Add template review to DoD", "#bfdbfe", 200, 100);
      const a2 = sticky(560, 200, "Write migration guide by Fri", "#bfdbfe", 200, 100);
      const a3 = sticky(560, 330, "Schedule retro follow-up in 2 wks", "#bfdbfe", 200, 100);
      const elements = { col1, col2, col3, h1, h2, h3, g1, g2, g3, i1, i2, i3, a1, a2, a3 };
      const map = Object.fromEntries(
        Object.entries(elements).map(([, el]) => [el.id, el])
      );
      return {
        version: 2,
        elements: map,
        elementOrder: Object.values(elements).map((el) => el.id),
      };
    },
  },
  {
    id: "kanban",
    label: "Kanban",
    title: "Kanban board",
    description: "To do, in progress, and done columns with sample tasks filled in.",
    build: () => {
      const col1 = columnBg(20, 56, 230, 420, "#f1f5f9");
      const col2 = columnBg(270, 56, 230, 420, "#eff6ff");
      const col3 = columnBg(520, 56, 230, 420, "#ecfdf5");
      const h1 = label(60, 24, "To do", "#64748b");
      const h2 = label(300, 24, "In progress", "#2563eb");
      const h3 = label(540, 24, "Done", "#059669");
      const t1 = sticky(40, 70, "Polish template thumbnails", "#e2e8f0");
      const t2 = sticky(40, 210, "Write launch checklist", "#e2e8f0");
      const t3 = sticky(40, 350, "Update onboarding copy", "#e2e8f0");
      const d1 = sticky(280, 70, "Recents filters UI", "#bfdbfe");
      const d2 = sticky(280, 210, "Billing integration QA", "#bfdbfe");
      const done1 = sticky(520, 70, "Native home routes", "#bbf7d0");
      const done2 = sticky(520, 210, "Recents API", "#bbf7d0");
      const done3 = sticky(520, 350, "Standalone editor shell", "#bbf7d0");
      const elements = { col1, col2, col3, h1, h2, h3, t1, t2, t3, d1, d2, done1, done2, done3 };
      const map = Object.fromEntries(
        Object.entries(elements).map(([, el]) => [el.id, el])
      );
      return {
        version: 2,
        elements: map,
        elementOrder: Object.values(elements).map((el) => el.id),
      };
    },
  },
];

export function getBoardTemplate(id: string) {
  return BOARD_TEMPLATES.find((t) => t.id === id) ?? BOARD_TEMPLATES[0];
}
