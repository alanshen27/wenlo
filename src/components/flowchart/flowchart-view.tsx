"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dagre from "dagre";
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Loader2, Plus, Trash2, Wand2, Maximize } from "lucide-react";
import { useLibrary } from "@/components/library/library-shell";
import type { SaveStatus } from "@/components/library/main-header";
import { Button } from "@/components/ui/button";
import { apiGet, apiPatch } from "@/lib/client/api";
import { flowchartRoute, libraryHome } from "@/lib/client/routes";
import {
  createEmptyFlow,
  flowColorStyle,
  newFlowId,
  normalizeFlow,
  FLOW_COLORS,
  type FlowColor,
  type FlowDoc,
  type FlowEdge,
  type FlowNode,
  type FlowPatch,
  type NodeShape,
} from "@/lib/flowcharts/flowchart-schema";
import { cn } from "@/lib/core/utils";

const SAVE_DEBOUNCE_MS = 600;
const NODE_W = 168;
const NODE_H = 56;

type FlowNodeData = {
  label: string;
  shape: NodeShape;
  color: string;
  readOnly: boolean;
  onCommitLabel: (id: string, label: string) => void;
};

// ---------------------------------------------------------------------------
// Custom node
// ---------------------------------------------------------------------------

const FlowNodeView = memo(function FlowNodeView({ id, data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(d.label);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!editing) setDraft(d.label);
  }, [d.label, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const style = flowColorStyle(d.color);
  const isDiamond = d.shape === "diamond";

  const commit = useCallback(() => {
    setEditing(false);
    if (draft !== d.label) d.onCommitLabel(id, draft);
  }, [draft, d, id]);

  const shapeClass =
    d.shape === "rounded"
      ? "rounded-full"
      : d.shape === "ellipse"
        ? "rounded-[50%]"
        : "rounded-lg";

  return (
    <div
      className={cn(
        "relative flex items-center justify-center border-2 text-center text-xs font-medium shadow-sm transition-shadow",
        !isDiamond && shapeClass,
        selected && "ring-2 ring-offset-2 ring-primary/60"
      )}
      style={{
        width: NODE_W,
        height: NODE_H,
        background: style.bg,
        borderColor: style.border,
        color: style.text,
        ...(isDiamond ? { transform: "rotate(45deg)", borderRadius: 8 } : {}),
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (!d.readOnly) setEditing(true);
      }}
    >
      <Handle type="target" position={Position.Top} className="!size-2 !bg-current !opacity-50" />
      <div
        className={cn("px-2", isDiamond && "[transform:rotate(-45deg)]")}
        style={isDiamond ? { width: NODE_W * 0.72 } : undefined}
      >
        {editing ? (
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") {
                setDraft(d.label);
                setEditing(false);
              }
            }}
            rows={2}
            className="w-full resize-none bg-transparent text-center text-xs font-medium outline-none"
            style={{ color: style.text }}
          />
        ) : (
          <span className="line-clamp-3 break-words">{d.label || "Untitled"}</span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!size-2 !bg-current !opacity-50" />
    </div>
  );
});

const nodeTypes = { flowNode: FlowNodeView };

// ---------------------------------------------------------------------------
// FlowDoc <-> React Flow conversion
// ---------------------------------------------------------------------------

function toRfNodes(
  scene: FlowDoc,
  readOnly: boolean,
  onCommitLabel: (id: string, label: string) => void
): Node[] {
  return scene.nodeOrder
    .map((id) => scene.nodes[id])
    .filter(Boolean)
    .map((n) => ({
      id: n.id,
      type: "flowNode",
      position: { x: n.x, y: n.y },
      data: { label: n.label, shape: n.shape, color: n.color, readOnly, onCommitLabel },
    }));
}

function toRfEdges(scene: FlowDoc): Edge[] {
  return scene.edgeOrder
    .map((id) => scene.edges[id])
    .filter(Boolean)
    .map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      markerEnd: { type: MarkerType.ArrowClosed },
    }));
}

function fromRf(nodes: Node[], edges: Edge[]): FlowDoc {
  const nodeMap: Record<string, FlowNode> = {};
  const nodeOrder: string[] = [];
  for (const n of nodes) {
    const d = n.data as FlowNodeData;
    nodeMap[n.id] = {
      id: n.id,
      x: Math.round(n.position.x),
      y: Math.round(n.position.y),
      label: d.label,
      shape: d.shape,
      color: d.color,
    };
    nodeOrder.push(n.id);
  }
  const edgeMap: Record<string, FlowEdge> = {};
  const edgeOrder: string[] = [];
  for (const e of edges) {
    edgeMap[e.id] = {
      id: e.id,
      source: e.source,
      target: e.target,
      label: typeof e.label === "string" ? e.label : undefined,
    };
    edgeOrder.push(e.id);
  }
  return { version: 1, nodes: nodeMap, nodeOrder, edges: edgeMap, edgeOrder };
}

/** Diff two scenes into a minimal patch (null when nothing changed). */
function diffFlow(prev: FlowDoc, next: FlowDoc): FlowPatch | null {
  const patch: FlowPatch = {};
  let changed = false;

  const nodeUpserts: Record<string, FlowNode> = {};
  const nodeDeletes: string[] = [];
  for (const id of Object.keys(next.nodes)) {
    if (JSON.stringify(prev.nodes[id]) !== JSON.stringify(next.nodes[id])) nodeUpserts[id] = next.nodes[id];
  }
  for (const id of Object.keys(prev.nodes)) if (!(id in next.nodes)) nodeDeletes.push(id);

  const edgeUpserts: Record<string, FlowEdge> = {};
  const edgeDeletes: string[] = [];
  for (const id of Object.keys(next.edges)) {
    if (JSON.stringify(prev.edges[id]) !== JSON.stringify(next.edges[id])) edgeUpserts[id] = next.edges[id];
  }
  for (const id of Object.keys(prev.edges)) if (!(id in next.edges)) edgeDeletes.push(id);

  if (Object.keys(nodeUpserts).length || nodeDeletes.length) {
    patch.nodes = {};
    if (Object.keys(nodeUpserts).length) patch.nodes.upserts = nodeUpserts;
    if (nodeDeletes.length) patch.nodes.deletes = nodeDeletes;
    patch.nodeOrder = next.nodeOrder;
    changed = true;
  }
  if (Object.keys(edgeUpserts).length || edgeDeletes.length) {
    patch.edges = {};
    if (Object.keys(edgeUpserts).length) patch.edges.upserts = edgeUpserts;
    if (edgeDeletes.length) patch.edges.deletes = edgeDeletes;
    patch.edgeOrder = next.edgeOrder;
    changed = true;
  }

  return changed ? patch : null;
}

/** Top-to-bottom dagre layout for the current graph. */
function layoutWithDagre(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 48, ranksep: 72 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of nodes) g.setNode(n.id, { width: NODE_W, height: NODE_H });
  for (const e of edges) g.setEdge(e.source, e.target);
  dagre.layout(g);
  return nodes.map((n) => {
    const pos = g.node(n.id);
    return pos
      ? { ...n, position: { x: Math.round(pos.x - NODE_W / 2), y: Math.round(pos.y - NODE_H / 2) } }
      : n;
  });
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

type FlowData = {
  id: string;
  title: string;
  folderId: string | null;
  libraryId: string;
  scene: FlowDoc;
};

export function FlowchartView() {
  const router = useRouter();
  const { flowchartId } = useParams<{ flowchartId: string }>();
  const { libraryId, canEdit, setHeader, refreshTree } = useLibrary();
  const readOnly = !canEdit;

  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState("");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [shape, setShape] = useState<NodeShape>("rounded");
  const [color, setColor] = useState<FlowColor>("indigo");

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const rfRef = useRef<ReactFlowInstance<Node, Edge> | null>(null);
  const lastSavedRef = useRef<FlowDoc>(createEmptyFlow());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onCommitLabel = useCallback(
    (id: string, label: string) => {
      setNodes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, data: { ...n.data, label } } : n))
      );
    },
    [setNodes]
  );

  // Load the flowchart.
  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    void (async () => {
      try {
        const data = await apiGet<FlowData>(`/api/flowcharts/${flowchartId}`);
        if (cancelled) return;
        if (data.libraryId && data.libraryId !== libraryId) {
          router.replace(flowchartRoute(data.libraryId, data.id));
          return;
        }
        const scene = normalizeFlow(data.scene);
        lastSavedRef.current = scene;
        setTitle(data.title);
        setFolderId(data.folderId);
        setNodes(toRfNodes(scene, !canEdit, onCommitLabel));
        setEdges(toRfEdges(scene));
        setLoaded(true);
      } catch {
        if (!cancelled) router.replace(libraryHome(libraryId));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [flowchartId, libraryId, canEdit, onCommitLabel, router, setNodes, setEdges]);

  const flush = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const next = fromRf(rfRef.current?.getNodes() ?? nodes, rfRef.current?.getEdges() ?? edges);
    const patch = diffFlow(lastSavedRef.current, next);
    if (!patch) return;
    lastSavedRef.current = next;
    setSaveStatus("saving");
    void apiPatch(`/api/flowcharts/${flowchartId}`, { patch })
      .then(() => {
        setSaveStatus("saved");
        if (savedTimer.current) clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => setSaveStatus("idle"), 1500);
      })
      .catch(() => setSaveStatus("error"));
  }, [flowchartId, nodes, edges]);

  const scheduleSave = useCallback(() => {
    if (readOnly) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
  }, [flush, readOnly]);

  // Persist whenever the graph changes (debounced; diff skips no-ops).
  useEffect(() => {
    if (!loaded || readOnly) return;
    scheduleSave();
  }, [nodes, edges, loaded, readOnly, scheduleSave]);

  useEffect(() => {
    const onBeforeUnload = () => flush();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      flush();
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, [flush]);

  useEffect(() => {
    if (!loaded) return;
    setHeader({ saveStatus, titleOverride: title, folderIdFallback: folderId });
  }, [loaded, saveStatus, title, folderId, setHeader]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (readOnly) return;
      setEdges((eds) =>
        addEdge({ ...connection, id: newFlowId(), markerEnd: { type: MarkerType.ArrowClosed } }, eds)
      );
    },
    [readOnly, setEdges]
  );

  const addNode = useCallback(() => {
    if (readOnly) return;
    const id = newFlowId();
    // Drop the node near the current viewport center.
    const center = rfRef.current?.screenToFlowPosition?.({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    const position = center ?? { x: 80 + Math.random() * 120, y: 80 + Math.random() * 120 };
    setNodes((prev) => [
      ...prev,
      {
        id,
        type: "flowNode",
        position,
        data: { label: "New", shape, color, readOnly, onCommitLabel },
        selected: true,
      },
    ]);
  }, [readOnly, shape, color, onCommitLabel, setNodes]);

  const applyStyleToSelection = useCallback(
    (next: { shape?: NodeShape; color?: FlowColor }) => {
      setNodes((prev) =>
        prev.map((n) =>
          n.selected
            ? {
                ...n,
                data: {
                  ...n.data,
                  ...(next.shape ? { shape: next.shape } : {}),
                  ...(next.color ? { color: next.color } : {}),
                },
              }
            : n
        )
      );
    },
    [setNodes]
  );

  const deleteSelection = useCallback(() => {
    if (readOnly) return;
    setNodes((prev) => prev.filter((n) => !n.selected));
    setEdges((prev) => prev.filter((e) => !e.selected));
  }, [readOnly, setNodes, setEdges]);

  const autoLayout = useCallback(() => {
    setNodes((prev) => layoutWithDagre(prev, rfRef.current?.getEdges() ?? edges));
    setTimeout(() => rfRef.current?.fitView({ padding: 0.25, duration: 400 }), 60);
  }, [edges, setNodes]);

  const saveTitle = useCallback(async () => {
    if (readOnly) return;
    try {
      const updated = await apiPatch<{ title: string }>(`/api/documents/${flowchartId}`, { title });
      setTitle(updated.title);
      refreshTree();
    } catch {
      /* keep local title */
    }
  }, [flowchartId, title, readOnly, refreshTree]);

  const hasSelection = useMemo(
    () => nodes.some((n) => n.selected) || edges.some((e) => e.selected),
    [nodes, edges]
  );

  if (!loaded) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          readOnly={readOnly}
          placeholder="Untitled flowchart"
          className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none read-only:cursor-default"
        />
        {readOnly ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            Read-only
          </span>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            <Button size="xs" variant="secondary" onClick={addNode}>
              <Plus className="size-3.5" />
              Node
            </Button>

            <div className="flex items-center rounded-lg border border-border p-0.5">
              {(["rectangle", "rounded", "ellipse", "diamond"] as NodeShape[]).map((s) => (
                <Button
                  key={s}
                  size="icon-sm"
                  variant={shape === s ? "secondary" : "ghost"}
                  title={s}
                  onClick={() => {
                    setShape(s);
                    applyStyleToSelection({ shape: s });
                  }}
                >
                  <ShapeGlyph shape={s} />
                </Button>
              ))}
            </div>

            <div className="flex items-center gap-1">
              {FLOW_COLORS.map((c) => {
                const s = flowColorStyle(c);
                return (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    onClick={() => {
                      setColor(c);
                      applyStyleToSelection({ color: c });
                    }}
                    className={cn(
                      "size-5 rounded-full border-2 transition-transform hover:scale-110",
                      color === c ? "ring-2 ring-offset-1 ring-primary/50" : ""
                    )}
                    style={{ background: s.bg, borderColor: s.border }}
                  />
                );
              })}
            </div>

            <Button size="xs" variant="ghost" onClick={autoLayout} title="Auto-arrange (top-down)">
              <Wand2 className="size-3.5" />
              Arrange
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={deleteSelection}
              disabled={!hasSelection}
              title="Delete selection"
            >
              <Trash2 className="size-3.5" />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => rfRef.current?.fitView({ padding: 0.25, duration: 400 })}
              title="Fit view"
            >
              <Maximize className="size-3.5" />
            </Button>
          </div>
        )}
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
          onConnect={onConnect}
          onDoubleClick={(e) => {
            // Double-clicking empty canvas adds a node there.
            if (readOnly) return;
            const target = e.target as HTMLElement;
            if (!target.closest(".react-flow__node")) addNode();
          }}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.2}
          maxZoom={2}
          zoomOnDoubleClick={false}
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          elementsSelectable={!readOnly}
          deleteKeyCode={readOnly ? null : ["Backspace", "Delete"]}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border)" />
          <Controls showInteractive={false} className="!border-border !bg-background/90 !shadow-md" />
          <MiniMap
            maskColor="rgb(0 0 0 / 0.08)"
            className="!border-border !bg-background/90 !shadow-md"
          />
        </ReactFlow>

        {!readOnly && (
          <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg border border-border bg-background/80 px-3 py-2 text-xs text-muted-foreground backdrop-blur-sm">
            Double-click canvas to add · drag a node&apos;s handle to connect · double-click a node to
            rename
          </div>
        )}
      </div>
    </div>
  );
}

function ShapeGlyph({ shape }: { shape: NodeShape }) {
  if (shape === "ellipse") return <span className="block size-3.5 rounded-full border-2 border-current" />;
  if (shape === "rounded") return <span className="block h-2.5 w-3.5 rounded-full border-2 border-current" />;
  if (shape === "diamond")
    return <span className="block size-3 rotate-45 border-2 border-current" />;
  return <span className="block size-3.5 rounded-[3px] border-2 border-current" />;
}
