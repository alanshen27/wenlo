// Flowchart scene model. A flowchart is a set of labeled nodes connected by
// edges, stored as flat id-keyed maps + separate order arrays — the same
// collision-friendly shape the whiteboard/deck use. Unlike the database, this
// is a free-form diagram (not records), so a JSON blob (`flowContent`) is the
// right fit; nothing here needs SQL querying.

export const FLOW_VERSION = 1 as const;

export type NodeShape = "rectangle" | "rounded" | "ellipse" | "diamond";

export type FlowNode = {
  id: string;
  x: number;
  y: number;
  label: string;
  shape: NodeShape;
  /** Accent color key (see FLOW_COLORS). */
  color: string;
};

export type FlowEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
};

export type FlowDoc = {
  version: typeof FLOW_VERSION;
  nodes: Record<string, FlowNode>;
  nodeOrder: string[];
  edges: Record<string, FlowEdge>;
  edgeOrder: string[];
};

/** A minimal, mergeable diff applied atomically on the server. */
export type FlowPatch = {
  nodes?: { upserts?: Record<string, FlowNode>; deletes?: string[] };
  edges?: { upserts?: Record<string, FlowEdge>; deletes?: string[] };
  nodeOrder?: string[];
  edgeOrder?: string[];
};

export const FLOW_COLORS = [
  "indigo",
  "blue",
  "green",
  "amber",
  "red",
  "purple",
  "slate",
] as const;

export type FlowColor = (typeof FLOW_COLORS)[number];

/** { bg, border, text } hex/classes for a node color, used by the custom node. */
export function flowColorStyle(color: string): { bg: string; border: string; text: string } {
  switch (color) {
    case "blue":
      return { bg: "#eff6ff", border: "#3b82f6", text: "#1e3a8a" };
    case "green":
      return { bg: "#ecfdf5", border: "#10b981", text: "#065f46" };
    case "amber":
      return { bg: "#fffbeb", border: "#f59e0b", text: "#92400e" };
    case "red":
      return { bg: "#fef2f2", border: "#ef4444", text: "#991b1b" };
    case "purple":
      return { bg: "#faf5ff", border: "#a855f7", text: "#6b21a8" };
    case "slate":
      return { bg: "#f8fafc", border: "#64748b", text: "#334155" };
    case "indigo":
    default:
      return { bg: "#eef2ff", border: "#6366f1", text: "#3730a3" };
  }
}

export function createEmptyFlow(): FlowDoc {
  const id = newFlowId();
  return {
    version: FLOW_VERSION,
    nodes: {
      [id]: { id, x: 0, y: 0, label: "Start", shape: "rounded", color: "indigo" },
    },
    nodeOrder: [id],
    edges: {},
    edgeOrder: [],
  };
}

export function newFlowId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `n-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

/** Coerce unknown JSON (or null) into a valid, well-ordered FlowDoc. */
export function normalizeFlow(input: unknown): FlowDoc {
  if (!input || typeof input !== "object") return createEmptyFlow();
  const raw = input as Partial<FlowDoc>;

  const nodes: Record<string, FlowNode> =
    raw.nodes && typeof raw.nodes === "object" ? (raw.nodes as Record<string, FlowNode>) : {};
  const edges: Record<string, FlowEdge> =
    raw.edges && typeof raw.edges === "object" ? (raw.edges as Record<string, FlowEdge>) : {};

  const nodeOrder = Array.isArray(raw.nodeOrder)
    ? raw.nodeOrder.filter((id) => id in nodes)
    : [];
  for (const id of Object.keys(nodes)) if (!nodeOrder.includes(id)) nodeOrder.push(id);

  // Edges are only valid when both endpoints still exist.
  const validEdges: Record<string, FlowEdge> = {};
  for (const [id, edge] of Object.entries(edges)) {
    if (edge && edge.source in nodes && edge.target in nodes) validEdges[id] = edge;
  }
  const edgeOrder = Array.isArray(raw.edgeOrder)
    ? raw.edgeOrder.filter((id) => id in validEdges)
    : [];
  for (const id of Object.keys(validEdges)) if (!edgeOrder.includes(id)) edgeOrder.push(id);

  return { version: FLOW_VERSION, nodes, nodeOrder, edges: validEdges, edgeOrder };
}

/** Pure merge of a patch into a scene; returns a new FlowDoc. */
export function applyFlowPatch(scene: FlowDoc, patch: FlowPatch): FlowDoc {
  const nodes: Record<string, FlowNode> = { ...scene.nodes };
  const edges: Record<string, FlowEdge> = { ...scene.edges };

  if (patch.nodes?.upserts) {
    for (const [id, node] of Object.entries(patch.nodes.upserts)) nodes[id] = { ...node, id };
  }
  if (patch.nodes?.deletes) {
    for (const id of patch.nodes.deletes) {
      delete nodes[id];
      // Deleting a node removes its incident edges.
      for (const [edgeId, edge] of Object.entries(edges)) {
        if (edge.source === id || edge.target === id) delete edges[edgeId];
      }
    }
  }
  if (patch.edges?.upserts) {
    for (const [id, edge] of Object.entries(patch.edges.upserts)) {
      if (edge.source in nodes && edge.target in nodes) edges[id] = { ...edge, id };
    }
  }
  if (patch.edges?.deletes) {
    for (const id of patch.edges.deletes) delete edges[id];
  }

  let nodeOrder = patch.nodeOrder
    ? patch.nodeOrder.filter((id) => id in nodes)
    : scene.nodeOrder.filter((id) => id in nodes);
  for (const id of Object.keys(nodes)) if (!nodeOrder.includes(id)) nodeOrder.push(id);

  let edgeOrder = patch.edgeOrder
    ? patch.edgeOrder.filter((id) => id in edges)
    : scene.edgeOrder.filter((id) => id in edges);
  for (const id of Object.keys(edges)) if (!edgeOrder.includes(id)) edgeOrder.push(id);

  return { version: FLOW_VERSION, nodes, nodeOrder, edges, edgeOrder };
}

/** Concatenated node + edge labels for the search index. */
export function deriveFlowText(scene: FlowDoc): string {
  const parts: string[] = [];
  for (const id of scene.nodeOrder) {
    const label = scene.nodes[id]?.label?.trim();
    if (label) parts.push(label);
  }
  for (const id of scene.edgeOrder) {
    const label = scene.edges[id]?.label?.trim();
    if (label) parts.push(label);
  }
  return parts.join("\n");
}
