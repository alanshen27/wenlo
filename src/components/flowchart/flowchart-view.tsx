"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
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
import { useLibraryHeader, useLibraryScope, useLibraryTree } from "@/components/library/context";
import { useDocumentHeader } from "@/hooks/use-document-header";
import { useDebouncedFlush } from "@/hooks/use-debounced-persist";
import { useFlowchartDocument } from "@/hooks/use-native-documents";
import { useSaveStatus } from "@/hooks/use-save-status";
import { Button } from "@/components/ui/button";
import { ViewError } from "@/components/ui/view";
import { apiPatch } from "@/lib/client/api";
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
import { shapePolygonSvgPoints } from "@/lib/canvas/shapes";
import { cn } from "@/lib/core/utils";

const SAVE_DEBOUNCE_MS = 600;
const NODE_W = 168;
const NODE_H = 56;
// A diamond is the only node with multiple source handles, so only its two
// outputs need ids (a single in/out handle matches a null handle on old edges).
const HANDLE_YES = "yes";
const HANDLE_NO = "no";

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

  const labelBody = editing ? (
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
      rows={1}
      className="w-full resize-none bg-transparent text-center text-xs font-medium outline-none"
      style={{ color: style.text }}
    />
  ) : (
    <span className="line-clamp-3 break-words">{d.label || "Untitled"}</span>
  );

  const handleClass = "!size-2 !bg-current !opacity-50";

  // Diamond = decision node: drawn as an SVG polygon (so the border, label, and
  // handles stay axis-aligned) with one input on top and two labeled outputs.
  if (isDiamond) {
    return (
      <div
        className="relative flex items-center justify-center text-center text-xs font-medium"
        style={{ width: NODE_W, height: NODE_H, color: style.text }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (!d.readOnly) setEditing(true);
        }}
      >
        <svg
          className="pointer-events-none absolute inset-0 overflow-visible"
          width={NODE_W}
          height={NODE_H}
        >
          <polygon
            points={shapePolygonSvgPoints("diamond", NODE_W, NODE_H) ?? ""}
            fill={style.bg}
            stroke={style.border}
            strokeWidth={2}
            className={cn("transition-[stroke]", selected && "stroke-primary")}
          />
        </svg>
        <Handle type="target" position={Position.Top} className={handleClass} />
        <div className="relative px-3" style={{ width: NODE_W * 0.6 }}>
          {labelBody}
        </div>
        <Handle id={HANDLE_YES} type="source" position={Position.Bottom} className={handleClass} />
        <Handle id={HANDLE_NO} type="source" position={Position.Right} className={handleClass} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex items-center justify-center border-2 text-center text-xs font-medium shadow-sm transition-shadow",
        shapeClass,
        selected && "ring-2 ring-offset-1 ring-primary/60"
      )}
      style={{
        width: NODE_W,
        height: NODE_H,
        background: style.bg,
        borderColor: style.border,
        color: style.text,
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (!d.readOnly) setEditing(true);
      }}
    >
      <Handle type="target" position={Position.Top} className={handleClass} />
      <div className="px-2">{labelBody}</div>
      <Handle type="source" position={Position.Bottom} className={handleClass} />
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
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
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
      sourceHandle: e.sourceHandle ?? undefined,
      targetHandle: e.targetHandle ?? undefined,
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

export function FlowchartView() {
  const { flowchartId } = useParams<{ flowchartId: string }>();
  const { libraryId, canEdit } = useLibraryScope();
  const { refreshTree } = useLibraryTree();
  const { setHeader } = useLibraryHeader();
  const { saveStatus, markSaving, markSaved, markError } = useSaveStatus();
  const { data: flowData, isLoading, loadError, reload } = useFlowchartDocument(
    flowchartId,
    libraryId
  );
  const readOnly = !canEdit;

  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState("");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [shape, setShape] = useState<NodeShape>("rounded");
  const [color, setColor] = useState<FlowColor>("indigo");

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const rfRef = useRef<ReactFlowInstance<Node, Edge> | null>(null);
  const lastSavedRef = useRef<FlowDoc>(createEmptyFlow());
  const loadedRef = useRef(false);
  const flushRef = useRef<() => void>(() => {});

  const onCommitLabel = useCallback(
    (id: string, label: string) => {
      setNodes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, data: { ...n.data, label } } : n))
      );
    },
    [setNodes]
  );

  useEffect(() => {
    if (!flowData) {
      setLoaded(false);
      return;
    }
    const scene = normalizeFlow(flowData.scene as FlowDoc);
    lastSavedRef.current = scene;
    setTitle(flowData.title);
    setFolderId(flowData.folderId);
    setNodes(toRfNodes(scene, !canEdit, onCommitLabel));
    setEdges(toRfEdges(scene));
    setLoaded(true);
  }, [flowData?.id, canEdit, onCommitLabel, setNodes, setEdges]);

  const flush = useCallback(() => {
    if (!loadedRef.current || readOnly) return;
    const next = fromRf(rfRef.current?.getNodes() ?? nodes, rfRef.current?.getEdges() ?? edges);
    const patch = diffFlow(lastSavedRef.current, next);
    if (!patch) return;
    lastSavedRef.current = next;
    markSaving();
    void apiPatch(`/api/flowcharts/${flowchartId}`, { patch })
      .then(() => markSaved())
      .catch(() => markError());
  }, [flowchartId, nodes, edges, readOnly, markSaving, markSaved, markError]);

  flushRef.current = flush;

  const { schedule: scheduleSave } = useDebouncedFlush(() => flushRef.current(), SAVE_DEBOUNCE_MS);

  // Keep the ref in lock-step with the loaded flag for `flush`'s guard.
  useEffect(() => {
    loadedRef.current = loaded;
  }, [loaded]);

  // Persist whenever the graph changes (debounced; diff skips no-ops).
  useEffect(() => {
    if (!loaded || readOnly) return;
    scheduleSave();
  }, [nodes, edges, loaded, readOnly, scheduleSave]);

  const headerState = useMemo(() => {
    if (!loaded) return undefined;
    return { saveStatus, titleOverride: title, folderIdFallback: folderId };
  }, [loaded, saveStatus, title, folderId]);

  useDocumentHeader(setHeader, headerState);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (readOnly) return;
      // Auto-label diamond branches from the handle they leave.
      const label =
        connection.sourceHandle === HANDLE_YES
          ? "Yes"
          : connection.sourceHandle === HANDLE_NO
            ? "No"
            : undefined;
      setEdges((eds) =>
        addEdge(
          { ...connection, id: newFlowId(), label, markerEnd: { type: MarkerType.ArrowClosed } },
          eds
        )
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

  if (loadError) {
    return (
      <ViewError
        title="Couldn't load this flowchart"
        message={loadError}
        onRetry={reload}
      />
    );
  }

  if (isLoading || !loaded) {
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
    return <span className="block h-3.5 w-3.5 size-3 rotate-45 border-2 border-current" />;
  return <span className="block size-3.5 rounded-[3px] border-2 border-current" />;
}
