import type { RecallPartialBlock } from "@/lib/editor/editor-content";

export type PageTemplate = {
  id: string;
  label: string;
  title: string;
  /** Card thumbnail + accent stripe color. */
  accent: string;
  preview: string;
  content: RecallPartialBlock[];
};

export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    id: "meeting-notes",
    label: "Meeting notes",
    title: "Meeting notes",
    accent: "#2563eb",
    preview:
      "Product sync · June 15\nAttendees: Alex, Jordan, Sam\nAgenda: Launch timeline, open bugs\nDecision: Ship July 1 soft launch",
    content: [
      { type: "heading", props: { level: 1 }, content: "Product sync" },
      {
        type: "paragraph",
        content: "Date: June 15, 2026 · Attendees: Alex, Jordan, Sam · Facilitator: Alex",
      },
      { type: "heading", props: { level: 2 }, content: "Agenda" },
      { type: "bulletListItem", content: "Launch timeline and scope cut line" },
      { type: "bulletListItem", content: "Open bugs blocking beta invites" },
      { type: "bulletListItem", content: "Marketing site copy review" },
      { type: "heading", props: { level: 2 }, content: "Discussion" },
      {
        type: "heading",
        props: { level: 3 },
        content: "Launch timeline",
      },
      {
        type: "paragraph",
        content:
          "Engineering is on track for feature freeze June 28. QA needs a full week for regression on billing and invites.",
      },
      {
        type: "heading",
        props: { level: 3 },
        content: "Open bugs",
      },
      {
        type: "bulletListItem",
        content: "Recents preview fails on empty plainText — P1, owner Sam",
      },
      {
        type: "bulletListItem",
        content: "Standalone shell missing library name in top bar — P2, owner Jordan",
      },
      { type: "heading", props: { level: 2 }, content: "Decisions" },
      {
        type: "bulletListItem",
        content: "Soft launch July 1 with billing disabled; enable billing July 15",
      },
      { type: "heading", props: { level: 2 }, content: "Action items" },
      { type: "bulletListItem", content: "Alex — finalize launch checklist by Wed" },
      { type: "bulletListItem", content: "Sam — fix recents preview bug by Thu" },
      { type: "bulletListItem", content: "Jordan — top bar library label by Fri" },
      { type: "heading", props: { level: 2 }, content: "Parking lot" },
      { type: "bulletListItem", content: "Native mobile home layout — revisit in Q3" },
    ],
  },
  {
    id: "project-brief",
    label: "Project brief",
    title: "Project brief",
    accent: "#7c3aed",
    preview:
      "Native app homes\nProblem: editors buried in library nav\nGoal: Word-style entry per content type\nSuccess: <90s to first edit",
    content: [
      { type: "heading", props: { level: 1 }, content: "Native app homes" },
      { type: "heading", props: { level: 2 }, content: "Executive summary" },
      {
        type: "paragraph",
        content:
          "Give each content type (docs, slides, boards, databases, flowcharts) its own home page with templates and cross-library recents — so users land in the right editor without navigating a library tree first.",
      },
      { type: "heading", props: { level: 2 }, content: "Problem" },
      {
        type: "paragraph",
        content:
          "Today every doc type lives under a library sidebar. Creating or resuming work requires knowing which library holds the item. New users bounce before they understand the model.",
      },
      { type: "heading", props: { level: 2 }, content: "Proposed solution" },
      {
        type: "bulletListItem",
        content: "Top-level routes per native type with template gallery + recents",
      },
      {
        type: "bulletListItem",
        content: "Standalone editor shell that hydrates library context from the item",
      },
      {
        type: "bulletListItem",
        content: "App launcher (waffle) to jump between types and back to library home",
      },
      { type: "heading", props: { level: 2 }, content: "Success metrics" },
      { type: "bulletListItem", content: "Time to first edit < 90 seconds (from 4+ min baseline)" },
      { type: "bulletListItem", content: "40% of returning users open via native home within 2 weeks" },
      { type: "bulletListItem", content: "Template usage on 25%+ of new creates" },
      { type: "heading", props: { level: 2 }, content: "Scope" },
      { type: "paragraph", content: "In: five native types, recents API, templates, standalone shell." },
      {
        type: "paragraph",
        content: "Out: files as native type, mind-map revival, mobile-native shells.",
      },
      { type: "heading", props: { level: 2 }, content: "Timeline" },
      {
        type: "bulletListItem",
        content: "Week 1–2: routes, registry, recents API",
      },
      { type: "bulletListItem", content: "Week 3: home UI, templates, previews" },
      { type: "bulletListItem", content: "Week 4: polish, beta rollout" },
      { type: "heading", props: { level: 2 }, content: "Stakeholders" },
      {
        type: "paragraph",
        content: "DRI: Alex · Eng: Jordan, Sam · Design: Morgan · PM: Alex",
      },
      { type: "heading", props: { level: 2 }, content: "Risks" },
      {
        type: "bulletListItem",
        content: "Dual navigation (library vs native) may confuse — mitigate with launcher + breadcrumbs",
      },
    ],
  },
  {
    id: "weekly-update",
    label: "Weekly update",
    title: "Weekly update",
    accent: "#059669",
    preview:
      "Week of June 9\nShipped: native homes, recents API\nIn progress: template previews\nBlocker: billing QA staffing",
    content: [
      { type: "heading", props: { level: 1 }, content: "Weekly update" },
      { type: "paragraph", content: "Week of June 9, 2026 · Platform team" },
      { type: "heading", props: { level: 2 }, content: "Highlights" },
      {
        type: "bulletListItem",
        content: "Shipped native home pages for docs, slides, boards, databases, and flowcharts",
      },
      {
        type: "bulletListItem",
        content: "Recents API returns cross-library items with plainText previews",
      },
      {
        type: "bulletListItem",
        content: "App launcher in sidebar — users can hop between wenlo and native apps",
      },
      { type: "heading", props: { level: 2 }, content: "Metrics" },
      { type: "bulletListItem", content: "WAU: 312 (+18% WoW)" },
      { type: "bulletListItem", content: "Median time-to-first-doc: 1m 42s (was 4m 08s)" },
      { type: "bulletListItem", content: "Support tickets about navigation: 3 (down from 11)" },
      { type: "heading", props: { level: 2 }, content: "In progress" },
      { type: "bulletListItem", content: "Richer templates with real starter content" },
      { type: "bulletListItem", content: "Slide & board thumbnail previews on recent cards" },
      { type: "bulletListItem", content: "Filters on recents (library, sort order)" },
      { type: "heading", props: { level: 2 }, content: "Blockers" },
      {
        type: "bulletListItem",
        content: "Billing QA — need dedicated QA slot next week (owner: Alex, escalate if no reply Mon)",
      },
      { type: "heading", props: { level: 2 }, content: "Next week" },
      { type: "bulletListItem", content: "Finish template polish and ship to beta cohort" },
      { type: "bulletListItem", content: "Start migration guide for old library-only URLs" },
      { type: "bulletListItem", content: "Performance pass on recents query at scale" },
    ],
  },
];

export function getPageTemplate(id: string) {
  return PAGE_TEMPLATES.find((t) => t.id === id) ?? PAGE_TEMPLATES[0];
}
