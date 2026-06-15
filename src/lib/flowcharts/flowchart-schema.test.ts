import { describe, expect, it } from "vitest";
import {
  applyFlowPatch,
  createEmptyFlow,
  deriveFlowText,
  FLOW_VERSION,
  normalizeFlow,
  type FlowDoc,
} from "./flowchart-schema";

function sceneOf(partial: Partial<FlowDoc>): FlowDoc {
  return {
    version: FLOW_VERSION,
    nodes: {},
    nodeOrder: [],
    edges: {},
    edgeOrder: [],
    ...partial,
  };
}

describe("createEmptyFlow", () => {
  it("seeds a single Start node referenced in nodeOrder", () => {
    const flow = createEmptyFlow();
    expect(flow.version).toBe(FLOW_VERSION);
    expect(flow.nodeOrder).toHaveLength(1);
    const id = flow.nodeOrder[0];
    expect(flow.nodes[id].label).toBe("Start");
    expect(flow.edgeOrder).toEqual([]);
  });
});

describe("normalizeFlow", () => {
  it("returns an empty flow for non-object input", () => {
    expect(normalizeFlow(null).nodeOrder).toHaveLength(1);
    expect(normalizeFlow("nope").nodeOrder).toHaveLength(1);
    expect(normalizeFlow(42).nodeOrder).toHaveLength(1);
  });

  it("appends nodes missing from nodeOrder", () => {
    const flow = normalizeFlow({
      version: FLOW_VERSION,
      nodes: {
        a: { id: "a", x: 0, y: 0, label: "A", shape: "rectangle", color: "indigo" },
        b: { id: "b", x: 1, y: 1, label: "B", shape: "diamond", color: "blue" },
      },
      nodeOrder: ["a"],
      edges: {},
      edgeOrder: [],
    });
    expect(flow.nodeOrder).toContain("a");
    expect(flow.nodeOrder).toContain("b");
  });

  it("drops nodeOrder ids that no longer exist", () => {
    const flow = normalizeFlow({
      version: FLOW_VERSION,
      nodes: { a: { id: "a", x: 0, y: 0, label: "A", shape: "rectangle", color: "indigo" } },
      nodeOrder: ["a", "ghost"],
      edges: {},
      edgeOrder: [],
    });
    expect(flow.nodeOrder).toEqual(["a"]);
  });

  it("drops edges whose endpoints are missing", () => {
    const flow = normalizeFlow({
      version: FLOW_VERSION,
      nodes: {
        a: { id: "a", x: 0, y: 0, label: "A", shape: "rectangle", color: "indigo" },
        b: { id: "b", x: 0, y: 0, label: "B", shape: "rectangle", color: "indigo" },
      },
      nodeOrder: ["a", "b"],
      edges: {
        good: { id: "good", source: "a", target: "b" },
        dangling: { id: "dangling", source: "a", target: "ghost" },
      },
      edgeOrder: ["good", "dangling"],
    });
    expect(Object.keys(flow.edges)).toEqual(["good"]);
    expect(flow.edgeOrder).toEqual(["good"]);
  });
});

describe("applyFlowPatch", () => {
  const base = sceneOf({
    nodes: {
      a: { id: "a", x: 0, y: 0, label: "A", shape: "rectangle", color: "indigo" },
      b: { id: "b", x: 0, y: 0, label: "B", shape: "rectangle", color: "indigo" },
    },
    nodeOrder: ["a", "b"],
    edges: { e1: { id: "e1", source: "a", target: "b" } },
    edgeOrder: ["e1"],
  });

  it("upserts a node and appends it to nodeOrder", () => {
    const next = applyFlowPatch(base, {
      nodes: {
        upserts: { c: { id: "c", x: 5, y: 5, label: "C", shape: "ellipse", color: "green" } },
      },
    });
    expect(next.nodes.c.label).toBe("C");
    expect(next.nodeOrder).toEqual(["a", "b", "c"]);
  });

  it("forces the upsert key as the node id", () => {
    const next = applyFlowPatch(base, {
      nodes: {
        upserts: { c: { id: "wrong", x: 0, y: 0, label: "C", shape: "ellipse", color: "green" } },
      },
    });
    expect(next.nodes.c.id).toBe("c");
  });

  it("deletes a node and its incident edges", () => {
    const next = applyFlowPatch(base, { nodes: { deletes: ["b"] } });
    expect(next.nodes.b).toBeUndefined();
    expect(next.nodeOrder).toEqual(["a"]);
    expect(next.edges.e1).toBeUndefined();
    expect(next.edgeOrder).toEqual([]);
  });

  it("ignores edge upserts with missing endpoints", () => {
    const next = applyFlowPatch(base, {
      edges: { upserts: { e2: { id: "e2", source: "a", target: "ghost" } } },
    });
    expect(next.edges.e2).toBeUndefined();
  });

  it("does not mutate the input scene", () => {
    const snapshot = JSON.parse(JSON.stringify(base));
    applyFlowPatch(base, { nodes: { deletes: ["a"] } });
    expect(base).toEqual(snapshot);
  });
});

describe("deriveFlowText", () => {
  it("joins node and edge labels in order, skipping blanks", () => {
    const scene = sceneOf({
      nodes: {
        a: { id: "a", x: 0, y: 0, label: "Question", shape: "diamond", color: "indigo" },
        b: { id: "b", x: 0, y: 0, label: "   ", shape: "rectangle", color: "indigo" },
      },
      nodeOrder: ["a", "b"],
      edges: { e1: { id: "e1", source: "a", target: "b", label: "Yes" } },
      edgeOrder: ["e1"],
    });
    expect(deriveFlowText(scene)).toBe("Question\nYes");
  });
});
