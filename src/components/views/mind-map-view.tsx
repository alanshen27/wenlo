"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Loader2, Network, Search, Workflow, GitFork, EyeOff } from "lucide-react";
import { MindMapNode } from "@/components/mind-map/mind-map-node";
import { useLibrary } from "@/components/library/library-shell";
import type { GraphEdge, GraphNode } from "@/lib/pages/page-graph";
import {
  layoutMindMap,
  type MindMapLayoutMode,
  type MindMapNodeData,
} from "@/lib/pages/mind-map-layout";
import { getFolderColorHex } from "@/lib/library/folder-colors";
import { apiGet } from "@/lib/client/api";
import { pageRoute } from "@/lib/client/routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/core/utils";

const nodeTypes = { mindMap: MindMapNode };

function miniMapColor(node: Node<MindMapNodeData>) {
  switch (node.data.kind) {
    case "library":
      return "#8b5cf6";
    case "folder":
      return getFolderColorHex(node.data.color);
    default:
      return node.data.degree >= 3 ? "#8b5cf6" : "#6366f1";
  }
}

export function MindMapView() {
  const router = useRouter();
  const { libraryId, activeLibrary } = useLibrary();

  const [graph, setGraph] = useState<
    { libraryId: string; nodes: GraphNode[]; edges: GraphEdge[] } | null
  >(null);
  const [error, setError] = useState<{ libraryId: string; message: string } | null>(null);

  const loading = !graph || graph.libraryId !== libraryId;

  const [mode, setMode] = useState<MindMapLayoutMode>("graph");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [hideOrphans, setHideOrphans] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<MindMapNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const rfRef = useRef<ReactFlowInstance<Node<MindMapNodeData>, Edge> | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiGet<{ nodes: GraphNode[]; edges: GraphEdge[] }>(`/api/libraries/${libraryId}/graph`)
      .then((data) => {
        if (cancelled) return;
        setError(null);
        setGraph({ libraryId, nodes: data.nodes, edges: data.edges });
      })
      .catch(() => {
        if (!cancelled) setError({ libraryId, message: "Could not load mind map" });
      });

    return () => {
      cancelled = true;
    };
  }, [libraryId]);

  const laidOut = useMemo(() => {
    if (!graph) return { nodes: [] as Node<MindMapNodeData>[], edges: [] as Edge[] };
    return layoutMindMap(graph, activeLibrary?.icon, mode);
  }, [graph, activeLibrary?.icon, mode]);

  // Seed the canvas whenever the layout (graph data or mode) changes. This
  // resets any manual drag positions, which is the expected behavior on a
  // layout switch.
  useEffect(() => {
    setNodes(laidOut.nodes);
    setEdges(laidOut.edges);
  }, [laidOut, setNodes, setEdges]);

  // Apply focus/search/orphan styling on top of whatever positions currently
  // exist (preserving manual drags), keyed on the interaction state.
  useEffect(() => {
    const q = query.trim().toLowerCase();

    const connected = new Set<string>();
    if (focusId) {
      connected.add(focusId);
      for (const edge of laidOut.edges) {
        if (edge.source === focusId || edge.target === focusId) {
          connected.add(edge.source);
          connected.add(edge.target);
        }
      }
    }

    const hiddenIds = new Set<string>();
    if (hideOrphans) {
      for (const node of laidOut.nodes) {
        if (node.data.kind === "page" && node.data.degree === 0) hiddenIds.add(node.id);
      }
    }

    setNodes((current) =>
      current.map((node) => {
        let dimmed = false;
        if (focusId) dimmed = !connected.has(node.id);
        else if (q) dimmed = !node.data.label.toLowerCase().includes(q);

        return {
          ...node,
          hidden: hiddenIds.has(node.id),
          data: { ...node.data, dimmed },
        };
      })
    );

    setEdges((current) =>
      current.map((edge) => {
        const base = (edge.data?.baseOpacity as number | undefined) ?? 1;
        const opacity = focusId
          ? connected.has(edge.source) && connected.has(edge.target)
            ? base
            : 0.1
          : base;
        return {
          ...edge,
          hidden: hiddenIds.has(edge.source) || hiddenIds.has(edge.target),
          style: { ...edge.style, opacity },
        };
      })
    );
  }, [laidOut, focusId, query, hideOrphans, setNodes, setEdges]);

  // Refit the viewport after a layout switch once nodes are in place.
  useEffect(() => {
    if (!laidOut.nodes.length) return;
    const id = setTimeout(() => {
      rfRef.current?.fitView({ padding: 0.25, duration: 400 });
    }, 60);
    return () => clearTimeout(id);
  }, [laidOut]);

  const pageCount = graph?.nodes.filter((n) => n.kind === "page").length ?? 0;
  const linkCount = graph?.edges.filter((e) => e.kind === "link").length ?? 0;

  const onNodeDoubleClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if ((node.data as MindMapNodeData).kind === "page") {
        router.push(pageRoute(libraryId, node.id));
      }
    },
    [libraryId, router]
  );

  const centerOnMatch = useCallback(() => {
    const q = query.trim().toLowerCase();
    if (!q) return;
    const match = nodes.find((n) => !n.hidden && n.data.label.toLowerCase().includes(q));
    if (match) {
      rfRef.current?.fitView({ nodes: [{ id: match.id }], duration: 500, maxZoom: 1.4 });
    }
  }, [nodes, query]);

  if (error && error.libraryId === libraryId) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-destructive">
        {error.message}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Building mind map…
      </div>
    );
  }

  if (!graph || pageCount === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <Network className="size-10 text-muted-foreground/50" />
        <p className="text-sm font-medium">No notes yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Create pages in your library to see them connected here. Type @ in a note to link to
          another page, or use page URLs in hyperlinks.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border p-0.5">
            <Button
              size="xs"
              variant={mode === "graph" ? "secondary" : "ghost"}
              onClick={() => setMode("graph")}
            >
              <GitFork className="size-3 rotate-180" />
              Graph
            </Button>
            <Button
              size="xs"
              variant={mode === "tree" ? "secondary" : "ghost"}
              onClick={() => setMode("tree")}
            >
              <Workflow className="size-3" />
              Tree
            </Button>
          </div>

          <Button
            size="xs"
            variant={hideOrphans ? "secondary" : "ghost"}
            onClick={() => setHideOrphans((v) => !v)}
            title="Hide pages with no cross-links"
          >
            <EyeOff className="size-3" />
            Hide orphans
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-44">
            <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") centerOnMatch();
              }}
              placeholder="Search notes…"
              className="h-7 pl-7 text-xs"
            />
          </div>
          <div className="hidden items-center gap-4 text-xs text-muted-foreground sm:flex">
            <span>
              {pageCount} note{pageCount !== 1 ? "s" : ""}
            </span>
            <span>
              {linkCount} cross-link{linkCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      <div className="relative flex-1 bg-linear-to-br from-primary/3 via-background to-primary/3">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onInit={(instance) => {
            rfRef.current = instance;
          }}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeMouseEnter={(_e, node) => setFocusId(node.id)}
          onNodeMouseLeave={() => setFocusId(null)}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.2}
          maxZoom={1.75}
          proOptions={{ hideAttribution: true }}
          nodesDraggable
          nodesConnectable={false}
          className="[&_.react-flow__edge-path]:stroke-[1.5]"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border)" />
          <Controls showInteractive={false} className="!border-border !bg-background/90 !shadow-md" />
          <MiniMap
            nodeColor={miniMapColor}
            maskColor="rgb(0 0 0 / 0.08)"
            className="!border-border !bg-background/90 !shadow-md"
          />
        </ReactFlow>

        <div
          className={cn(
            "pointer-events-none absolute bottom-4 left-4 rounded-lg border border-border bg-background/80 px-3 py-2 text-xs text-muted-foreground backdrop-blur-sm"
          )}
        >
          Drag to rearrange · Hover to highlight links · Double-click to open
        </div>
      </div>
    </div>
  );
}
