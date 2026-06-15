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
  build: () => BoardDoc;
};

function sticky(x: number, y: number, text: string, fill: string) {
  const id = newId();
  return {
    id,
    type: "sticky" as const,
    x,
    y,
    w: 180,
    h: 140,
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
    build: () => {
      const s1 = sticky(80, 80, "Idea one", "#fef08a");
      const s2 = sticky(300, 60, "Idea two", "#bfdbfe");
      const s3 = sticky(520, 100, "Idea three", "#bbf7d0");
      const s4 = sticky(180, 260, "Idea four", "#fbcfe8");
      return {
        version: 2,
        elements: { [s1.id]: s1, [s2.id]: s2, [s3.id]: s3, [s4.id]: s4 },
        elementOrder: [s1.id, s2.id, s3.id, s4.id],
      };
    },
  },
  {
    id: "retro",
    label: "Retro board",
    title: "Retro",
    build: () => {
      const good = sticky(60, 80, "What went well", "#bbf7d0");
      const improve = sticky(320, 80, "What to improve", "#fef08a");
      const action = sticky(580, 80, "Action items", "#bfdbfe");
      return {
        version: 2,
        elements: { [good.id]: good, [improve.id]: improve, [action.id]: action },
        elementOrder: [good.id, improve.id, action.id],
      };
    },
  },
  {
    id: "kanban",
    label: "Kanban",
    title: "Kanban board",
    build: () => {
      const todo = sticky(60, 80, "To do", "#e2e8f0");
      const doing = sticky(300, 80, "Doing", "#bfdbfe");
      const done = sticky(540, 80, "Done", "#bbf7d0");
      return {
        version: 2,
        elements: { [todo.id]: todo, [doing.id]: doing, [done.id]: done },
        elementOrder: [todo.id, doing.id, done.id],
      };
    },
  },
];

export function getBoardTemplate(id: string) {
  return BOARD_TEMPLATES.find((t) => t.id === id) ?? BOARD_TEMPLATES[0];
}
