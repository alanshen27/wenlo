import type { RecallPartialBlock } from "@/lib/editor/editor-content";

function inline(text: string) {
  return [{ type: "text" as const, text, styles: {} }];
}

function h(level: 1 | 2 | 3, text: string): RecallPartialBlock {
  return {
    type: "heading",
    props: {
      level,
      isToggleable: false,
      backgroundColor: "default",
      textColor: "default",
      textAlignment: "left",
    },
    content: inline(text),
  };
}

function p(text: string): RecallPartialBlock {
  return {
    type: "paragraph",
    props: {
      backgroundColor: "default",
      textColor: "default",
      textAlignment: "left",
    },
    content: inline(text),
  };
}

function li(text: string): RecallPartialBlock {
  return {
    type: "bulletListItem",
    props: {
      backgroundColor: "default",
      textColor: "default",
      textAlignment: "left",
    },
    content: inline(text),
  };
}

export type PageTemplate = {
  id: string;
  label: string;
  title: string;
  description: string;
  preview: string;
  content: RecallPartialBlock[];
};

export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    id: "meeting-notes",
    label: "Meeting notes",
    title: "Meeting notes",
    description: "Agenda, discussion notes, decisions, and action items with owners.",
    preview:
      "Product sync\nAgenda\nLaunch timeline · open bugs\nDecision: Ship July 1 soft launch\nAlex — finalize checklist",
    content: [
      h(1, "Product sync"),
      p("Date: June 15, 2026 · Attendees: Alex, Jordan, Sam · Facilitator: Alex"),
      h(2, "Agenda"),
      li("Launch timeline and scope cut line"),
      li("Open bugs blocking beta invites"),
      li("Marketing site copy review"),
      h(2, "Discussion"),
      h(3, "Launch timeline"),
      p(
        "Engineering is on track for feature freeze June 28. QA needs a full week for regression on billing and invites."
      ),
      h(3, "Open bugs"),
      li("Recents preview fails on empty plainText — P1, owner Sam"),
      li("Standalone shell missing library name in top bar — P2, owner Jordan"),
      h(2, "Decisions"),
      li("Soft launch July 1 with billing disabled; enable billing July 15"),
      h(2, "Action items"),
      li("Alex — finalize launch checklist by Wed"),
      li("Sam — fix recents preview bug by Thu"),
      li("Jordan — top bar library label by Fri"),
      h(2, "Parking lot"),
      li("Native mobile home layout — revisit in Q3"),
    ],
  },
  {
    id: "project-brief",
    label: "Project brief",
    title: "Project brief",
    description: "Problem, solution, metrics, scope, timeline, and stakeholder map.",
    preview:
      "Native app homes\nExecutive summary\nProblem: editors buried in library nav\nSuccess: <90s to first edit\nWeek 3: home UI + templates",
    content: [
      h(1, "Native app homes"),
      h(2, "Executive summary"),
      p(
        "Give each content type (docs, slides, boards, databases, flowcharts) its own home page with templates and cross-library recents — so users land in the right editor without navigating a library tree first."
      ),
      h(2, "Problem"),
      p(
        "Today every doc type lives under a library sidebar. Creating or resuming work requires knowing which library holds the item. New users bounce before they understand the model."
      ),
      h(2, "Proposed solution"),
      li("Top-level routes per native type with template gallery + recents"),
      li("Standalone editor shell that hydrates library context from the item"),
      li("App launcher (waffle) to jump between types and back to library home"),
      h(2, "Success metrics"),
      li("Time to first edit < 90 seconds (from 4+ min baseline)"),
      li("40% of returning users open via native home within 2 weeks"),
      li("Template usage on 25%+ of new creates"),
      h(2, "Scope"),
      p("In: five native types, recents API, templates, standalone shell."),
      p("Out: files as native type, mind-map revival, mobile-native shells."),
      h(2, "Timeline"),
      li("Week 1–2: routes, registry, recents API"),
      li("Week 3: home UI, templates, previews"),
      li("Week 4: polish, beta rollout"),
      h(2, "Stakeholders"),
      p("DRI: Alex · Eng: Jordan, Sam · Design: Morgan · PM: Alex"),
      h(2, "Risks"),
      li(
        "Dual navigation (library vs native) may confuse — mitigate with launcher + breadcrumbs"
      ),
    ],
  },
  {
    id: "weekly-update",
    label: "Weekly update",
    title: "Weekly update",
    description: "Highlights, metrics, in-progress work, blockers, and next week's plan.",
    preview:
      "Weekly update\nHighlights\nShipped native homes + recents API\nBlockers: Billing QA staffing\nNext: Template polish + beta",
    content: [
      h(1, "Weekly update"),
      p("Week of June 9, 2026 · Platform team"),
      h(2, "Highlights"),
      li("Shipped native home pages for docs, slides, boards, databases, and flowcharts"),
      li("Recents API returns cross-library items with plainText previews"),
      li("App launcher in sidebar — users can hop between wenlo and native apps"),
      h(2, "Metrics"),
      li("WAU: 312 (+18% WoW)"),
      li("Median time-to-first-doc: 1m 42s (was 4m 08s)"),
      li("Support tickets about navigation: 3 (down from 11)"),
      h(2, "In progress"),
      li("Richer templates with real starter content"),
      li("Slide & board thumbnail previews on recent cards"),
      li("Filters on recents (library, sort order)"),
      h(2, "Blockers"),
      li(
        "Billing QA — need dedicated QA slot next week (owner: Alex, escalate if no reply Mon)"
      ),
      h(2, "Next week"),
      li("Finish template polish and ship to beta cohort"),
      li("Start migration guide for old library-only URLs"),
      li("Performance pass on recents query at scale"),
    ],
  },
  {
    id: "prd",
    label: "Product spec",
    title: "Product spec",
    description: "PRD skeleton: user stories, requirements, edge cases, and launch checklist.",
    preview:
      "Billing v1\nUser stories\nAs a team admin I can add a card\nRequirements\nStripe Checkout + webhooks\nLaunch checklist",
    content: [
      h(1, "Billing v1"),
      p("DRI: Alex · Target: July 15 · Eng: Jordan, Sam · Design: Morgan"),
      h(2, "Problem"),
      p(
        "Teams on the beta want to pay without leaving wenlo. Today billing is manual — we can't scale past 50 design partners."
      ),
      h(2, "User stories"),
      li("As a team admin, I can add a payment method and see our plan tier"),
      li("As a team admin, I can invite seats and see per-seat pricing"),
      li("As finance, I receive invoices by email with line items"),
      h(2, "Requirements"),
      h(3, "Must have"),
      li("Stripe Checkout for card capture"),
      li("Webhook handling for payment succeeded / failed"),
      li("Plan limits enforced on seat count"),
      h(3, "Nice to have"),
      li("Annual billing toggle"),
      li("Usage summary on the plan settings page"),
      h(2, "Edge cases"),
      li("Card expires mid-cycle — grace period + email"),
      li("Downgrade with more seats than new tier allows"),
      li("Failed payment retry for 7 days before read-only"),
      h(2, "Launch checklist"),
      li("Legal review of ToS update"),
      li("QA on downgrade + upgrade paths"),
      li("Support macro for billing questions"),
      li("Metrics dashboard: MRR, churn, failed payments"),
    ],
  },
  {
    id: "one-on-one",
    label: "1:1 notes",
    title: "1:1 notes",
    description: "Recurring manager report sync with talking points, feedback, and follow-ups.",
    preview:
      "Alex / Jordan · 1:1\nSince last time\nShipped recents filters\nTalking points\nCareer goals for H2\nAction items",
    content: [
      h(1, "Alex / Jordan · 1:1"),
      p("June 18, 2026 · Bi-weekly · Private"),
      h(2, "Since last time"),
      li("Jordan shipped recents filters UI — live in beta"),
      li("Alex escalated billing QA staffing — slot confirmed for next week"),
      li("Jordan mentored Sam on the debounced persist hook"),
      h(2, "Talking points"),
      h(3, "What's going well"),
      p("Strong ownership on native home polish. Communication in standup is crisp."),
      h(3, "Growth areas"),
      p("Scope on template content — aim for fewer, richer templates vs many thin ones."),
      h(3, "Career"),
      p("Jordan wants more system design exposure in H2. Pair on billing architecture review."),
      h(2, "Feedback"),
      li("From Jordan: appreciate the clear PRD for billing — made scoping easy"),
      li("From Alex: push back earlier when timeline feels tight"),
      h(2, "Action items"),
      li("Jordan — draft billing webhook sequence diagram by Thu"),
      li("Alex — schedule architecture review for Fri"),
      li("Both — revisit career goals doc before next 1:1"),
    ],
  },
];

export function getPageTemplate(id: string) {
  return PAGE_TEMPLATES.find((t) => t.id === id) ?? PAGE_TEMPLATES[0];
}
