import { FLOW_VERSION, newFlowId, type FlowDoc } from "@/lib/flowcharts/flowchart-schema";

export type FlowTemplate = {
  id: string;
  label: string;
  title: string;
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
    title: "Process flow",
    build: () => {
      const a = node("Start", 0, 0, "rounded", "green");
      const b = node("Step", 220, 0);
      const c = node("End", 440, 0, "rounded", "slate");
      const e1 = edge(a.id, b.id);
      const e2 = edge(b.id, c.id);
      return {
        version: FLOW_VERSION,
        nodes: { [a.id]: a, [b.id]: b, [c.id]: c },
        nodeOrder: [a.id, b.id, c.id],
        edges: { [e1.id]: e1, [e2.id]: e2 },
        edgeOrder: [e1.id, e2.id],
      };
    },
  },
  {
    id: "decision",
    label: "Decision tree",
    title: "Decision flow",
    build: () => {
      const start = node("Start", 200, 0, "rounded", "green");
      const decision = node("Decision?", 160, 120, "diamond", "amber");
      const yes = node("Yes path", 40, 260, "rounded", "blue");
      const no = node("No path", 320, 260, "rounded", "red");
      const e1 = edge(start.id, decision.id);
      const e2 = edge(decision.id, yes.id, "Yes");
      const e3 = edge(decision.id, no.id, "No");
      return {
        version: FLOW_VERSION,
        nodes: { [start.id]: start, [decision.id]: decision, [yes.id]: yes, [no.id]: no },
        nodeOrder: [start.id, decision.id, yes.id, no.id],
        edges: { [e1.id]: e1, [e2.id]: e2, [e3.id]: e3 },
        edgeOrder: [e1.id, e2.id, e3.id],
      };
    },
  },
  {
    id: "swimlane",
    label: "Handoff",
    title: "Handoff flow",
    build: () => {
      const req = node("Request", 0, 0, "rectangle", "indigo");
      const review = node("Review", 200, 0, "rectangle", "purple");
      const ship = node("Ship", 400, 0, "rounded", "green");
      const e1 = edge(req.id, review.id);
      const e2 = edge(review.id, ship.id);
      return {
        version: FLOW_VERSION,
        nodes: { [req.id]: req, [review.id]: review, [ship.id]: ship },
        nodeOrder: [req.id, review.id, ship.id],
        edges: { [e1.id]: e1, [e2.id]: e2 },
        edgeOrder: [e1.id, e2.id],
      };
    },
  },
];

export function getFlowTemplate(id: string) {
  return FLOW_TEMPLATES.find((t) => t.id === id) ?? FLOW_TEMPLATES[0];
}
