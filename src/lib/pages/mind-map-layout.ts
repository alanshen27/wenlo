import dagre from "dagre";
import type { Edge, Node } from "@xyflow/react";
import type { GraphEdge, GraphNode, PageGraph } from "@/lib/pages/page-graph";

export type MindMapNodeData = {
  label: string;
  kind: GraphNode["kind"];
  color?: string;
  libraryIcon?: string;
  dimmed?: boolean;
};

const NODE_SIZE = {
  library: { width: 200, height: 52 },
  folder: { width: 176, height: 44 },
  page: { width: 168, height: 40 },
} as const;

export function layoutMindMap(
  graph: PageGraph,
  libraryIcon?: string
): { nodes: Node<MindMapNodeData>[]; edges: Edge[] } {
  const hierarchyEdges = graph.edges.filter((edge) => edge.kind === "contains");

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
    const size = NODE_SIZE[node.kind];
    layoutGraph.setNode(node.id, { width: size.width, height: size.height });
  }

  for (const edge of hierarchyEdges) {
    layoutGraph.setEdge(edge.source, edge.target);
  }

  dagre.layout(layoutGraph);

  const nodes: Node<MindMapNodeData>[] = graph.nodes.map((node) => {
    const size = NODE_SIZE[node.kind];
    const position = layoutGraph.node(node.id);

    return {
      id: node.id,
      type: "mindMap",
      position: {
        x: position.x - size.width / 2,
        y: position.y - size.height / 2,
      },
      data: {
        label: node.label,
        kind: node.kind,
        color: node.color,
        libraryIcon,
      },
    };
  });

  const edges: Edge[] = graph.edges.map((edge) => toFlowEdge(edge));

  return { nodes, edges };
}

function toFlowEdge(edge: GraphEdge): Edge {
  const isLink = edge.kind === "link";

  return {
    id: `${edge.source}-${edge.target}-${edge.kind}`,
    source: edge.source,
    target: edge.target,
    type: isLink ? "smoothstep" : "default",
    animated: isLink,
    style: isLink
      ? { stroke: "#a78bfa", strokeWidth: 2, strokeDasharray: "6 4" }
      : { stroke: "var(--border)", strokeWidth: 1.5 },
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
