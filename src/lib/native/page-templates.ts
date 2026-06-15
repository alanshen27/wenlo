import type { RecallPartialBlock } from "@/lib/editor/editor-content";

export type PageTemplate = {
  id: string;
  label: string;
  title: string;
  preview: string;
  content: RecallPartialBlock[];
};

export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    id: "meeting-notes",
    label: "Meeting notes",
    title: "Meeting notes",
    preview:
      "Meeting notes\nDate · Attendees\nAgenda\n• Topic one\n• Topic two\nAction items",
    content: [
      { type: "heading", props: { level: 1 }, content: "Meeting notes" },
      { type: "paragraph", content: "Date · Attendees" },
      { type: "heading", props: { level: 2 }, content: "Agenda" },
      { type: "bulletListItem", content: "Topic one" },
      { type: "bulletListItem", content: "Topic two" },
      { type: "heading", props: { level: 2 }, content: "Notes" },
      { type: "paragraph" },
      { type: "heading", props: { level: 2 }, content: "Action items" },
      { type: "bulletListItem", content: "Follow up on…" },
    ],
  },
  {
    id: "project-brief",
    label: "Project brief",
    title: "Project brief",
    preview:
      "Project brief\nOverview\nGoals\n• Goal one\n• Goal two\nTimeline\nNext steps",
    content: [
      { type: "heading", props: { level: 1 }, content: "Project brief" },
      { type: "heading", props: { level: 2 }, content: "Overview" },
      { type: "paragraph", content: "What we're building and why." },
      { type: "heading", props: { level: 2 }, content: "Goals" },
      { type: "bulletListItem", content: "Goal one" },
      { type: "bulletListItem", content: "Goal two" },
      { type: "heading", props: { level: 2 }, content: "Timeline" },
      { type: "paragraph", content: "Key milestones and dates." },
      { type: "heading", props: { level: 2 }, content: "Next steps" },
      { type: "bulletListItem", content: "…" },
    ],
  },
  {
    id: "weekly-update",
    label: "Weekly update",
    title: "Weekly update",
    preview:
      "Weekly update\nHighlights\n• Shipped…\nIn progress\n• Working on…\nBlockers\n• None",
    content: [
      { type: "heading", props: { level: 1 }, content: "Weekly update" },
      { type: "heading", props: { level: 2 }, content: "Highlights" },
      { type: "bulletListItem", content: "Shipped…" },
      { type: "heading", props: { level: 2 }, content: "In progress" },
      { type: "bulletListItem", content: "Working on…" },
      { type: "heading", props: { level: 2 }, content: "Blockers" },
      { type: "bulletListItem", content: "None" },
    ],
  },
];

export function getPageTemplate(id: string) {
  return PAGE_TEMPLATES.find((t) => t.id === id) ?? PAGE_TEMPLATES[0];
}
