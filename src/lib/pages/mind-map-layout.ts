import dagre from "dagre";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import type { Edge, Node } from "@xyflow/react";
import type { GraphEdge, GraphNode, PageGraph } from "@/lib/pages/page-graph";

export type MindMapLayoutMode = "graph" | "tree";

export type MindMapNodeData = {
  label: string;
  kind: GraphNode["kind"];
  color?: string;
  libraryIcon?: string;
  dimmed?: boolean;
  /** Number of cross-links touching this node. */
  degree: number;
  /** Visual scale factor derived from degree (1 = base size). */
  scale: number;
};

const BASE_SIZE = {
  library: { width: 200, height: 52 },
  folder: { width: 176, height: 44 },
  page: { width: 168, height: 40 },
} as const;

const LIBRARY_NODE_ID = "__library__";

/** Cross-link (non-containment) degree per node. */
function computeLinkDegree(graph: PageGraph): Map<string, number> {
  const degree = new Map<string, number>();
  for (const edge of graph.edges) {
    if (edge.kind !== "link") continue;
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }
  return degree;
}

/** Pages grow with how many cross-links they have, so hubs read as hubs. */
function pageScale(degree: number): number {
  return 1 + Math.min(degree, 8) * 0.11;
}

function nodeDimensions(kind: GraphNode["kind"], scale: number) {
  const base = BASE_SIZE[kind];
  if (kind !== "page") return { width: base.width, height: base.height };
  return {
    width: Math.round(base.width * Math.min(scale, 1.6)),
    height: Math.round(base.height * Math.min(scale, 1.35)),
  };
}

export function layoutMindMap(
  graph: PageGraph,
  libraryIcon?: string,
  mode: MindMapLayoutMode = "graph"
): { nodes: Node<MindMapNodeData>[]; edges: Edge[] } {
  const degreeMap = computeLinkDegree(graph);

  const meta = new Map(
    graph.nodes.map((node) => {
      const degree = degreeMap.get(node.id) ?? 0;
      const scale = node.kind === "page" ? pageScale(degree) : 1;
      return [node.id, { degree, scale, ...nodeDimensions(node.kind, scale) }];
    })
  );

  const positions =
    mode === "tree" ? treeLayout(graph, meta) : forceLayout(graph, meta);

  const nodes: Node<MindMapNodeData>[] = graph.nodes.map((node) => {
    const m = meta.get(node.id)!;
    const pos = positions.get(node.id) ?? { x: 0, y: 0 };

    return {
      id: node.id,
      type: "mindMap",
      position: { x: pos.x - m.width / 2, y: pos.y - m.height / 2 },
      data: {
        label: node.label,
        kind: node.kind,
        color: node.color,
        libraryIcon,
        degree: m.degree,
        scale: m.scale,
      },
    };
  });

  const edges: Edge[] = graph.edges.map((edge) => toFlowEdge(edge, mode));

  return { nodes, edges };
}

type NodeMeta = { degree: number; scale: number; width: number; height: number };

/** Hierarchical dagre layout (library -> folders -> pages). */
function treeLayout(
  graph: PageGraph,
  meta: Map<string, NodeMeta>
): Map<string, { x: number; y: number }> {
  const layoutGraph = new dagre.graphlib.Graph();
  layoutGraph.setDefaultEdgeLabel(() => ({}));
  layoutGraph.setGraph({
    rankdir: "TB",
    nodesep: 56,
    ranksep: 88,
    marginx: 48,
    marginy: 48,
  });

  for (const node of graph.nodes) {
    const m = meta.get(node.id)!;
    layoutGraph.setNode(node.id, { width: m.width, height: m.height });
  }

  for (const edge of graph.edges) {
    if (edge.kind === "contains") layoutGraph.setEdge(edge.source, edge.target);
  }

  dagre.layout(layoutGraph);

  const positions = new Map<string, { x: number; y: number }>();
  for (const node of graph.nodes) {
    const p = layoutGraph.node(node.id);
    positions.set(node.id, { x: p.x, y: p.y });
  }
  return positions;
}

type SimNode = SimulationNodeDatum & { id: string; radius: number };
type SimLink = SimulationLinkDatum<SimNode> & { distance: number; strength: number };

/** Force-directed layout driven by cross-links, with containment as soft springs. */
function forceLayout(
  graph: PageGraph,
  meta: Map<string, NodeMeta>
): Map<string, { x: number; y: number }> {
  const simNodes: SimNode[] = graph.nodes.map((node) => {
    const m = meta.get(node.id)!;
    const radius = Math.hypot(m.width, m.height) / 2;
    const isLibrary = node.id === LIBRARY_NODE_ID;
    return {
      id: node.id,
      radius,
      // Pin the library node at the origin so the map has a stable anchor.
      ...(isLibrary ? { fx: 0, fy: 0 } : {}),
    };
  });

  const simLinks: SimLink[] = graph.edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
    distance: edge.kind === "link" ? 170 : 130,
    strength: edge.kind === "link" ? 0.45 : 0.7,
  }));

  const simulation = forceSimulation(simNodes)
    .force(
      "link",
      forceLink<SimNode, SimLink>(simLinks)
        .id((d) => d.id)
        .distance((d) => d.distance)
        .strength((d) => d.strength)
    )
    .force("charge", forceManyBody().strength(-650))
    .force("collide", forceCollide<SimNode>().radius((d) => d.radius + 16))
    .force("center", forceCenter(0, 0))
    .force("x", forceX(0).strength(0.04))
    .force("y", forceY(0).strength(0.04))
    .stop();

  const ticks = 320;
  for (let i = 0; i < ticks; i++) simulation.tick();

  const positions = new Map<string, { x: number; y: number }>();
  for (const node of simNodes) {
    positions.set(node.id, { x: node.x ?? 0, y: node.y ?? 0 });
  }
  return positions;
}

function toFlowEdge(edge: GraphEdge, mode: MindMapLayoutMode): Edge {
  const isLink = edge.kind === "link";
  // In graph mode the cross-links are the story, so fade containment edges.
  const containOpacity = mode === "graph" ? 0.35 : 1;

  return {
    id: `${edge.source}-${edge.target}-${edge.kind}`,
    source: edge.source,
    target: edge.target,
    type: isLink ? "smoothstep" : "default",
    animated: isLink,
    style: isLink
      ? { stroke: "#a78bfa", strokeWidth: 2, strokeDasharray: "6 4" }
      : { stroke: "var(--border)", strokeWidth: 1.5, opacity: containOpacity },
    data: { kind: edge.kind },
  };
}

export function applyFocus(
  nodes: Node<MindMapNodeData>[],
  edges: Edge[],
  focusId: string | null
): { nodes: Node<MindMapNodeData>[]; edges: Edge[] } {
  if (!focusId) return { nodes, edges };

  const connected = new Set<string>([focusId]);
  for (const edge of edges) {
    if (edge.source === focusId || edge.target === focusId) {
      connected.add(edge.source);
      connected.add(edge.target);
    }
  }

  return {
    nodes: nodes.map((node) => ({
      ...node,
      data: { ...node.data, dimmed: !connected.has(node.id) },
    })),
    edges: edges.map((edge) => ({
      ...edge,
      style: {
        ...edge.style,
        opacity:
          connected.has(edge.source) && connected.has(edge.target)
            ? 1
            : 0.12,
      },
    })),
  };
}
