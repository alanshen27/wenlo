import type { RecallPartialBlock } from "@/lib/editor/editor-content";

type BnColor = "gray" | "brown" | "red" | "orange" | "yellow" | "green" | "blue" | "purple" | "pink";

function h(level: 1 | 2 | 3, text: string, bg?: BnColor): RecallPartialBlock {
  return {
    type: "heading",
    props: { level, ...(bg ? { backgroundColor: bg } : {}) },
    content: text,
  };
}

function p(text: string, bg?: BnColor): RecallPartialBlock {
  return {
    type: "paragraph",
    ...(bg ? { props: { backgroundColor: bg } } : {}),
    content: text,
  };
}

function li(text: string, bg?: BnColor): RecallPartialBlock {
  return {
    type: "bulletListItem",
    ...(bg ? { props: { backgroundColor: bg } } : {}),
    content: text,
  };
}

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
      "Product sync · June 15\nAttendees: Alex, Jordan, Sam\nAgenda: Launch timeline, open bugs\nDecision: Ship July 1 soft launch",
    content: [
      h(1, "Product sync", "blue"),
      p("Date: June 15, 2026 · Attendees: Alex, Jordan, Sam · Facilitator: Alex"),
      h(2, "Agenda", "purple"),
      li("Launch timeline and scope cut line"),
      li("Open bugs blocking beta invites"),
      li("Marketing site copy review"),
      h(2, "Discussion", "gray"),
      h(3, "Launch timeline"),
      p(
        "Engineering is on track for feature freeze June 28. QA needs a full week for regression on billing and invites."
      ),
      h(3, "Open bugs"),
      li("Recents preview fails on empty plainText — P1, owner Sam", "red"),
      li("Standalone shell missing library name in top bar — P2, owner Jordan", "orange"),
      h(2, "Decisions", "green"),
      li("Soft launch July 1 with billing disabled; enable billing July 15", "green"),
      h(2, "Action items", "yellow"),
      li("Alex — finalize launch checklist by Wed"),
      li("Sam — fix recents preview bug by Thu"),
      li("Jordan — top bar library label by Fri"),
      h(2, "Parking lot", "gray"),
      li("Native mobile home layout — revisit in Q3"),
    ],
  },
  {
    id: "project-brief",
    label: "Project brief",
    title: "Project brief",
    preview:
      "Native app homes\nProblem: editors buried in library nav\nGoal: Word-style entry per content type\nSuccess: <90s to first edit",
    content: [
      h(1, "Native app homes", "purple"),
      h(2, "Executive summary", "blue"),
      p(
        "Give each content type (docs, slides, boards, databases, flowcharts) its own home page with templates and cross-library recents — so users land in the right editor without navigating a library tree first.",
        "blue"
      ),
      h(2, "Problem", "red"),
      p(
        "Today every doc type lives under a library sidebar. Creating or resuming work requires knowing which library holds the item. New users bounce before they understand the model.",
        "red"
      ),
      h(2, "Proposed solution", "green"),
      li("Top-level routes per native type with template gallery + recents"),
      li("Standalone editor shell that hydrates library context from the item"),
      li("App launcher (waffle) to jump between types and back to library home"),
      h(2, "Success metrics", "yellow"),
      li("Time to first edit < 90 seconds (from 4+ min baseline)"),
      li("40% of returning users open via native home within 2 weeks"),
      li("Template usage on 25%+ of new creates"),
      h(2, "Scope", "gray"),
      p("In: five native types, recents API, templates, standalone shell.", "green"),
      p("Out: files as native type, mind-map revival, mobile-native shells.", "orange"),
      h(2, "Timeline", "blue"),
      li("Week 1–2: routes, registry, recents API"),
      li("Week 3: home UI, templates, previews"),
      li("Week 4: polish, beta rollout"),
      h(2, "Stakeholders"),
      p("DRI: Alex · Eng: Jordan, Sam · Design: Morgan · PM: Alex"),
      h(2, "Risks", "red"),
      li(
        "Dual navigation (library vs native) may confuse — mitigate with launcher + breadcrumbs",
        "red"
      ),
    ],
  },
  {
    id: "weekly-update",
    label: "Weekly update",
    title: "Weekly update",
    preview:
      "Week of June 9\nShipped: native homes, recents API\nIn progress: template previews\nBlocker: billing QA staffing",
    content: [
      h(1, "Weekly update", "green"),
      p("Week of June 9, 2026 · Platform team"),
      h(2, "Highlights", "green"),
      li("Shipped native home pages for docs, slides, boards, databases, and flowcharts", "green"),
      li("Recents API returns cross-library items with plainText previews", "green"),
      li("App launcher in sidebar — users can hop between wenlo and native apps", "green"),
      h(2, "Metrics", "blue"),
      li("WAU: 312 (+18% WoW)"),
      li("Median time-to-first-doc: 1m 42s (was 4m 08s)"),
      li("Support tickets about navigation: 3 (down from 11)"),
      h(2, "In progress", "yellow"),
      li("Richer templates with real starter content"),
      li("Slide & board thumbnail previews on recent cards"),
      li("Filters on recents (library, sort order)"),
      h(2, "Blockers", "red"),
      li(
        "Billing QA — need dedicated QA slot next week (owner: Alex, escalate if no reply Mon)",
        "red"
      ),
      h(2, "Next week", "purple"),
      li("Finish template polish and ship to beta cohort"),
      li("Start migration guide for old library-only URLs"),
      li("Performance pass on recents query at scale"),
    ],
  },
];

export function getPageTemplate(id: string) {
  return PAGE_TEMPLATES.find((t) => t.id === id) ?? PAGE_TEMPLATES[0];
}
