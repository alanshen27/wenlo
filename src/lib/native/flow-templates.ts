import { FLOW_VERSION, newFlowId, type FlowDoc } from "@/lib/flowcharts/flowchart-schema";

export type FlowTemplate = {
  id: string;
  label: string;
  title: string;
  description: string;
  build: () => FlowDoc;
};

function node(
  label: string,
  x: number,
  y: number,
  shape: "rectangle" | "rounded" | "ellipse" | "diamond" = "rounded",
  color = "indigo"
) {
  const id = newFlowId();
  return { id, x, y, label, shape, color };
}

function edge(source: string, target: string, label?: string) {
  const id = newFlowId();
  return { id, source, target, label };
}

export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    id: "linear",
    label: "Linear process",
    title: "Feature delivery flow",
    description: "Six-step pipeline from request through triage, design, build, QA, and ship.",
    build: () => {
      const a = node("New request", 0, 0, "rounded", "green");
      const b = node("Triage & prioritize", 200, 0);
      const c = node("Design & spec", 400, 0, "rectangle", "purple");
      const d = node("Build", 600, 0);
      const e = node("Review & QA", 800, 0, "rectangle", "amber");
      const f = node("Ship", 1000, 0, "rounded", "green");
      const edges = [
        edge(a.id, b.id),
        edge(b.id, c.id),
        edge(c.id, d.id),
        edge(d.id, e.id),
        edge(e.id, f.id),
      ];
      const nodes = { [a.id]: a, [b.id]: b, [c.id]: c, [d.id]: d, [e.id]: e, [f.id]: f };
      return {
        version: FLOW_VERSION,
        nodes,
        nodeOrder: [a.id, b.id, c.id, d.id, e.id, f.id],
        edges: Object.fromEntries(edges.map((e) => [e.id, e])),
        edgeOrder: edges.map((e) => e.id),
      };
    },
  },
  {
    id: "decision",
    label: "Decision tree",
    title: "Signup flow",
    description: "Branch on invite link vs solo signup, through onboarding to first doc.",
    build: () => {
      const start = node("User lands on signup", 180, 0, "rounded", "green");
      const decision = node("Has invite link?", 140, 120, "diamond", "amber");
      const invite = node("Join existing library", 0, 260, "rounded", "blue");
      const solo = node("Create personal library", 280, 260, "rounded", "indigo");
      const onboard = node("Onboarding checklist", 140, 400, "rectangle", "purple");
      const done = node("Home — pick first doc type", 140, 520, "rounded", "green");
      const e1 = edge(start.id, decision.id);
      const e2 = edge(decision.id, invite.id, "Yes");
      const e3 = edge(decision.id, solo.id, "No");
      const e4 = edge(invite.id, onboard.id);
      const e5 = edge(solo.id, onboard.id);
      const e6 = edge(onboard.id, done.id);
      const edges = [e1, e2, e3, e4, e5, e6];
      const nodes = {
        [start.id]: start,
        [decision.id]: decision,
        [invite.id]: invite,
        [solo.id]: solo,
        [onboard.id]: onboard,
        [done.id]: done,
      };
      return {
        version: FLOW_VERSION,
        nodes,
        nodeOrder: [start.id, decision.id, invite.id, solo.id, onboard.id, done.id],
        edges: Object.fromEntries(edges.map((e) => [e.id, e])),
        edgeOrder: edges.map((e) => e.id),
      };
    },
  },
  {
    id: "swimlane",
    label: "Handoff",
    title: "Support → engineering handoff",
    description: "Ticket path from customer report through support, eng fix, and confirmation.",
    build: () => {
      const req = node("Customer reports bug", 0, 0, "rectangle", "indigo");
      const triage = node("Support reproduces", 220, 0, "rectangle", "purple");
      const eng = node("Engineering investigates", 440, 0, "rectangle", "blue");
      const fix = node("Fix deployed", 660, 0, "rounded", "green");
      const close = node("Support confirms with customer", 880, 0, "rounded", "slate");
      const e1 = edge(req.id, triage.id, "Ticket");
      const e2 = edge(triage.id, eng.id, "Escalate");
      const e3 = edge(eng.id, fix.id, "PR merged");
      const e4 = edge(fix.id, close.id, "Notify");
      const edges = [e1, e2, e3, e4];
      const nodes = {
        [req.id]: req,
        [triage.id]: triage,
        [eng.id]: eng,
        [fix.id]: fix,
        [close.id]: close,
      };
      return {
        version: FLOW_VERSION,
        nodes,
        nodeOrder: [req.id, triage.id, eng.id, fix.id, close.id],
        edges: Object.fromEntries(edges.map((e) => [e.id, e])),
        edgeOrder: edges.map((e) => e.id),
      };
    },
  },
];

export function getFlowTemplate(id: string) {
  return FLOW_TEMPLATES.find((t) => t.id === id) ?? FLOW_TEMPLATES[0];
}
