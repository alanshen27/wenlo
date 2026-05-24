"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  type Node,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Loader2, Network } from "lucide-react";
import { MindMapNode } from "@/components/mind-map/mind-map-node";
import { useLibrary } from "@/components/library/library-shell";
import type { GraphEdge, GraphNode } from "@/lib/page-graph";
import { applyFocus, layoutMindMap, type MindMapNodeData } from "@/lib/mind-map-layout";
import { getFolderColorHex } from "@/lib/folder-colors";
import { apiGet } from "@/lib/api";
import { pageRoute } from "@/lib/routes";

const nodeTypes = { mindMap: MindMapNode };

function miniMapColor(node: Node<MindMapNodeData>) {
  switch (node.data.kind) {
    case "library":
      return "#8b5cf6";
    case "folder":
      return getFolderColorHex(node.data.color);
    default:
      return "#6366f1";
  }
}

export function MindMapView() {
  const router = useRouter();
  const { libraryId, activeLibrary } = useLibrary();

  const [graph, setGraph] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiGet<{ nodes: GraphNode[]; edges: GraphEdge[] }>(`/api/libraries/${libraryId}/graph`)
      .then((data) => {
        if (!cancelled) setGraph(data);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load mind map");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [libraryId]);

  const { nodes, edges } = useMemo(() => {
    if (!graph) return { nodes: [], edges: [] };
    const laidOut = layoutMindMap(graph, activeLibrary?.icon);
    return applyFocus(laidOut.nodes, laidOut.edges, focusId);
  }, [graph, activeLibrary?.icon, focusId]);

  const pageCount = graph?.nodes.filter((n) => n.kind === "page").length ?? 0;
  const linkCount = graph?.edges.filter((e) => e.kind === "link").length ?? 0;

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if ((node.data as MindMapNodeData).kind === "page") {
        router.push(pageRoute(libraryId, node.id));
      }
    },
    [libraryId, router]
  );

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Building mind map…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-destructive">{error}</div>
    );
  }

  if (!graph || pageCount === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <Network className="size-10 text-muted-foreground/50" />
        <p className="text-sm font-medium">No notes yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Create pages in your library to see them connected here. Link between notes using page
          URLs to draw cross-references.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2 pb-3">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            {pageCount} note{pageCount !== 1 ? "s" : ""}
          </span>
          <span>
            {linkCount} cross-link{linkCount !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-px w-4 bg-border" />
            Folder
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-px w-4 border-t border-dashed border-violet-400" />
            Link
          </span>
        </div>
      </div>

      <div className="relative flex-1 bg-gradient-to-br from-violet-500/[0.03] via-background to-indigo-500/[0.03]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          onNodeMouseEnter={(_e, node) => setFocusId(node.id)}
          onNodeMouseLeave={() => setFocusId(null)}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.2}
          maxZoom={1.75}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
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

        <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg border border-border bg-background/80 px-3 py-2 text-xs text-muted-foreground backdrop-blur-sm">
          Scroll to zoom · Drag to pan · Click a note to open
        </div>
      </div>
    </div>
  );
}
