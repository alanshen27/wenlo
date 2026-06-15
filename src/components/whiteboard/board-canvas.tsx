"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Stage,
  Layer,
  Group,
  Rect,
  Line,
  Text as KonvaText,
  Arrow,
  Label,
  Tag,
  Transformer,
} from "react-konva";
import Konva from "konva";
import {
  type BoardDoc,
  type BoardElement,
  type BoardPatch,
  type ConnectorElement,
  type ConnectorEndpoint,
} from "@/lib/boards/board-schema";
import type { ShapeKind } from "@/lib/canvas/shapes";
import {
  absBounds,
  computeSnap,
  localBounds,
  resolveConnector,
  scaleElement,
  type Box,
  type SnapLine,
} from "@/components/whiteboard/board-geometry";
import { BoardImageNode } from "@/components/whiteboard/board-image";
import { ShapeNode } from "@/components/canvas/shape-node";
import { readImageSize } from "@/lib/canvas/image";
import { BoardToolbar, type Tool } from "@/components/whiteboard/board-toolbar";
import type { LockHolder, LockMap, RemoteCursor } from "@/components/whiteboard/use-board-collab";

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 5;
const STICKY_FILL = "#fde68a";

type Viewport = { x: number; y: number; zoom: number };

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `el_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export type BoardCanvasHandle = { exportPng: () => string | null };

type Props = {
  scene: BoardDoc;
  readOnly: boolean;
  libraryId: string;
  folderId: string | null;
  remoteLocks: LockMap;
  remoteCursors: RemoteCursor[];
  onPatch: (patch: BoardPatch) => void;
  requestLock: (ids: string[]) => Promise<{ granted: string[]; denied: { elementId: string; holder: LockHolder }[] }>;
  releaseLock: (ids: string[]) => void;
  publishCursor: (pos: { x: number; y: number } | null) => void;
  registerHandle: (handle: BoardCanvasHandle | null) => void;
};

const CURSOR_THROTTLE_MS = 45;
/** Distance (screen px) within which a dragged element snaps to another's edge/center. */
const SNAP_THRESHOLD_PX = 6;
/** Minimum travel (scene units) before a new pen point is recorded — bounds path size. */
const MIN_PEN_DISTANCE = 1.5;

export function BoardCanvas({
  scene,
  readOnly,
  libraryId,
  folderId,
  remoteLocks,
  remoteCursors,
  onPatch,
  requestLock,
  releaseLock,
  publishCursor,
  registerHandle,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const trRef = useRef<Konva.Transformer | null>(null);
  const nodeMap = useRef<Map<string, Konva.Group>>(new Map());
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [size, setSize] = useState({ width: 0, height: 0 });
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [tool, setTool] = useState<Tool>("select");
  const [color, setColor] = useState("#1f2937");
  const [fill, setFill] = useState<string>("transparent");
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<BoardElement | null>(null);
  // In-progress drag rectangle for text/sticky creation (scene coords). `w`/`h`
  // may be negative while dragging up/left; normalized on commit.
  const [creationBox, setCreationBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [denied, setDenied] = useState<LockHolder | null>(null);
  const [guides, setGuides] = useState<SnapLine[]>([]);

  const drawingRef = useRef(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const lastCursorSentRef = useRef(0);

  // --- Container sizing ---
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // --- Expose PNG export ---
  useEffect(() => {
    registerHandle({
      exportPng: () => {
        const stage = stageRef.current;
        if (!stage) return null;
        const tr = trRef.current;
        tr?.hide();
        const url = stage.toDataURL({ pixelRatio: 2 });
        tr?.show();
        return url;
      },
    });
    return () => registerHandle(null);
  }, [registerHandle]);

  // --- Attach transformer to the selected node ---
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = selectedId ? nodeMap.current.get(selectedId) : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, scene]);

  const denyFlash = useCallback((holder: LockHolder) => {
    setDenied(holder);
    setTimeout(() => setDenied(null), 2200);
  }, []);

  const selectElement = useCallback(
    async (id: string) => {
      if (readOnly) return;
      if (remoteLocks[id]) {
        denyFlash(remoteLocks[id]);
        return;
      }
      const previous = selectedId;
      setSelectedId(id);
      const { granted, denied: deniedList } = await requestLock([id]);
      if (!granted.includes(id)) {
        setSelectedId(previous ?? null);
        if (deniedList[0]) denyFlash(deniedList[0].holder);
        return;
      }
      if (previous && previous !== id) releaseLock([previous]);
    },
    [readOnly, remoteLocks, selectedId, requestLock, releaseLock, denyFlash]
  );

  const deselect = useCallback(() => {
    if (selectedId) releaseLock([selectedId]);
    setSelectedId(null);
  }, [selectedId, releaseLock]);

  const commitElement = useCallback(
    (el: BoardElement, append: boolean) => {
      onPatch({
        upserts: { [el.id]: el },
        ...(append ? { elementOrder: [...scene.elementOrder.filter((i) => i !== el.id), el.id] } : {}),
      });
    },
    [onPatch, scene.elementOrder]
  );

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    const id = selectedId;
    setSelectedId(null);
    // Also remove any connectors anchored to the deleted element.
    const deletes = [id];
    for (const otherId of scene.elementOrder) {
      const el = scene.elements[otherId];
      if (el?.type !== "connector") continue;
      const refs =
        (el.start.kind === "element" && el.start.elementId === id) ||
        (el.end.kind === "element" && el.end.elementId === id);
      if (refs) deletes.push(otherId);
    }
    onPatch({ deletes });
    releaseLock([id]);
  }, [selectedId, scene.elementOrder, scene.elements, onPatch, releaseLock]);

  // Z-order is the element array order (later = drawn on top).
  const reorderSelected = useCallback(
    (to: "front" | "back") => {
      if (!selectedId || readOnly) return;
      const id = selectedId;
      const rest = scene.elementOrder.filter((x) => x !== id);
      if (rest.length === scene.elementOrder.length) return;
      const next = to === "front" ? [...rest, id] : [id, ...rest];
      onPatch({ elementOrder: next });
    },
    [selectedId, readOnly, scene.elementOrder, onPatch]
  );

  // --- Clipboard (in-app copy/paste) ---
  const clipboardRef = useRef<BoardElement | null>(null);
  const copySelected = useCallback(() => {
    if (!selectedId) return;
    const el = scene.elements[selectedId];
    // Connectors reference other elements by id, so a standalone copy is
    // meaningless — skip them.
    if (el && el.type !== "connector") clipboardRef.current = el;
  }, [selectedId, scene.elements]);
  const pasteClipboard = useCallback(() => {
    const el = clipboardRef.current;
    if (!el || readOnly) return;
    const id = newId();
    const copy = { ...el, id, x: el.x + 24, y: el.y + 24 } as BoardElement;
    commitElement(copy, true);
    setSelectedId(id);
    void requestLock([id]);
  }, [readOnly, commitElement, requestLock]);

  // --- Keyboard: space-pan, tool shortcuts, delete ---
  useEffect(() => {
    const isTyping = () => {
      const el = document.activeElement;
      return el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isTyping()) {
        setSpaceHeld(true);
        return;
      }
      if (isTyping() || editingId) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId && !readOnly) {
        e.preventDefault();
        deleteSelected();
        return;
      }
      // Arrow-key nudge of the selected element (Shift = larger step).
      if (
        selectedId &&
        !readOnly &&
        (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight")
      ) {
        const el = scene.elements[selectedId];
        if (el && el.type !== "connector") {
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
          const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
          onPatch({ upserts: { [el.id]: { ...el, x: el.x + dx, y: el.y + dy } } });
          return;
        }
      }
      const meta = e.metaKey || e.ctrlKey;
      if (meta && !e.altKey && e.key.toLowerCase() === "c" && selectedId && !readOnly) {
        e.preventDefault();
        copySelected();
        return;
      }
      if (meta && !e.altKey && e.key.toLowerCase() === "v" && !readOnly) {
        e.preventDefault();
        pasteClipboard();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const map: Record<string, Tool> = {
        v: "select",
        h: "pan",
        p: "pen",
        r: "rect",
        o: "ellipse",
        l: "line",
        a: "arrow",
        c: "connector",
        t: "text",
        s: "sticky",
      };
      const next = map[e.key.toLowerCase()];
      if (next && !readOnly) setTool(next);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceHeld(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [selectedId, editingId, readOnly, deleteSelected, scene.elements, onPatch, copySelected, pasteClipboard]);

  // --- Pointer helpers ---
  const relativePointer = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return null;
    return stage.getRelativePointerPosition();
  }, []);

  // Topmost non-connector element whose bounds contain a scene point (for
  // attaching connector endpoints to shapes).
  const hitTest = useCallback(
    (pos: { x: number; y: number }): string | null => {
      for (let i = scene.elementOrder.length - 1; i >= 0; i--) {
        const id = scene.elementOrder[i];
        const el = scene.elements[id];
        if (!el || el.type === "connector") continue;
        const b = absBounds(el);
        if (pos.x >= b.x && pos.x <= b.x + b.w && pos.y >= b.y && pos.y <= b.y + b.h) {
          return id;
        }
      }
      return null;
    },
    [scene.elementOrder, scene.elements]
  );

  const panning = tool === "pan" || spaceHeld;

  const handleStageMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (panning) return; // stage drag handles panning
      const stage = stageRef.current;
      const clickedEmpty = e.target === stage;

      if (tool === "select") {
        if (clickedEmpty) deselect();
        return;
      }
      if (readOnly) return;

      const pos = relativePointer();
      if (!pos) return;

      // Text / sticky: drag to set bounds (a plain click falls back to a
      // default size — see handleStageMouseUp).
      if (tool === "text" || tool === "sticky") {
        drawingRef.current = true;
        startRef.current = pos;
        setCreationBox({ x: pos.x, y: pos.y, w: 0, h: 0 });
        return;
      }

      // Drag-to-create tools (pen / shapes / arrow / line).
      drawingRef.current = true;
      startRef.current = pos;
      const id = newId();
      if (tool === "connector") {
        const startHit = hitTest(pos);
        setDraft({
          id,
          type: "connector",
          x: 0,
          y: 0,
          start: startHit ? { kind: "element", elementId: startHit } : { kind: "point", x: pos.x, y: pos.y },
          end: { kind: "point", x: pos.x, y: pos.y },
          stroke: color,
          strokeWidth,
        });
      } else if (tool === "pen") {
        setDraft({ id, type: "path", x: pos.x, y: pos.y, points: [0, 0], stroke: color, strokeWidth });
      } else if (tool === "arrow") {
        setDraft({ id, type: "arrow", x: pos.x, y: pos.y, points: [0, 0, 0, 0], stroke: color, strokeWidth });
      } else {
        // Box-based shape tools (line + polygons). Lines are stroke-only.
        const shape = tool as ShapeKind;
        setDraft({
          id,
          type: "shape",
          shape,
          x: pos.x,
          y: pos.y,
          w: 0,
          h: 0,
          stroke: color,
          strokeWidth,
          ...(shape === "line" ? {} : { fill }),
        });
      }
    },
    [panning, tool, readOnly, deselect, relativePointer, color, fill, strokeWidth, hitTest]
  );

  const handleStageMouseMove = useCallback(() => {
    const pos = relativePointer();

    // Broadcast our pointer to collaborators (throttled), independent of drawing.
    if (pos) {
      const now = Date.now();
      if (now - lastCursorSentRef.current > CURSOR_THROTTLE_MS) {
        lastCursorSentRef.current = now;
        publishCursor(pos);
      }
    }

    if (!drawingRef.current || !startRef.current || !pos) return;
    const start = startRef.current;

    if (tool === "text" || tool === "sticky") {
      setCreationBox({ x: start.x, y: start.y, w: pos.x - start.x, h: pos.y - start.y });
      return;
    }

    setDraft((prev) => {
      if (!prev) return prev;
      if (prev.type === "path") {
        const nx = pos.x - prev.x;
        const ny = pos.y - prev.y;
        const lastX = prev.points[prev.points.length - 2];
        const lastY = prev.points[prev.points.length - 1];
        // Skip points that barely moved so long strokes don't bloat the scene.
        if ((nx - lastX) ** 2 + (ny - lastY) ** 2 < MIN_PEN_DISTANCE ** 2) return prev;
        return { ...prev, points: [...prev.points, nx, ny] };
      }
      if (prev.type === "arrow") {
        return { ...prev, points: [0, 0, pos.x - start.x, pos.y - start.y] };
      }
      if (prev.type === "connector") {
        return { ...prev, end: { kind: "point", x: pos.x, y: pos.y } };
      }
      // shapes
      return { ...prev, w: pos.x - start.x, h: pos.y - start.y } as BoardElement;
    });
  }, [relativePointer, publishCursor, tool]);

  const handleStageMouseUp = useCallback(() => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    startRef.current = null;

    // Text / sticky: build the element from the drag rectangle. A negligible
    // drag (a plain click) falls back to a sensible default size.
    if (tool === "text" || tool === "sticky") {
      const box = creationBox;
      setCreationBox(null);
      if (!box) {
        setTool("select");
        return;
      }
      const nx = box.w < 0 ? box.x + box.w : box.x;
      const ny = box.h < 0 ? box.y + box.h : box.y;
      const aw = Math.abs(box.w);
      const ah = Math.abs(box.h);
      const dragged = aw > 8 || ah > 8;
      const id = newId();
      let el: BoardElement;
      if (tool === "text") {
        const w = dragged ? Math.max(40, aw) : 220;
        const fontSize = dragged && ah > 16 ? Math.max(12, Math.min(240, Math.round(ah / 1.3))) : 24;
        el = { id, type: "text", x: dragged ? nx : box.x, y: dragged ? ny : box.y, text: "", w, fontSize, color };
      } else {
        const w = dragged ? Math.max(40, aw) : 180;
        const h = dragged ? Math.max(40, ah) : 180;
        el = {
          id,
          type: "sticky",
          x: dragged ? nx : box.x,
          y: dragged ? ny : box.y,
          text: "",
          w,
          h,
          fill: STICKY_FILL,
          color: "#1f2937",
        };
      }
      commitElement(el, true);
      setTool("select");
      setSelectedId(id);
      setEditingId(id);
      void requestLock([id]);
      return;
    }

    const el = draft;
    setDraft(null);
    if (!el) return;

    // Connectors: bind the end to whatever shape it was released over.
    if (el.type === "connector") {
      const pos = relativePointer();
      const endHit = pos ? hitTest(pos) : null;
      const end: ConnectorEndpoint = endHit
        ? { kind: "element", elementId: endHit }
        : pos
          ? { kind: "point", x: pos.x, y: pos.y }
          : el.end;
      // Discard degenerate connectors (same shape both ends, or zero-length).
      const sameElement =
        el.start.kind === "element" && end.kind === "element" && el.start.elementId === end.elementId;
      const resolved = resolveConnector({ ...el, end }, scene.elements);
      const tooShort =
        !resolved ||
        (Math.abs(resolved[0] - resolved[2]) < 4 && Math.abs(resolved[1] - resolved[3]) < 4);
      if (sameElement || tooShort) {
        setTool("select");
        return;
      }
      commitElement({ ...el, end }, true);
      setTool("select");
      return;
    }

    // Normalize shapes that were drawn right-to-left / bottom-to-top.
    let finalized = el;
    if (el.type === "shape") {
      const x = el.w < 0 ? el.x + el.w : el.x;
      const y = el.h < 0 ? el.y + el.h : el.y;
      finalized = { ...el, x, y, w: Math.abs(el.w), h: Math.abs(el.h) };
      if (finalized.type === "shape" && finalized.shape !== "line" && finalized.w < 3 && finalized.h < 3) {
        return; // ignore stray click
      }
    }
    if (el.type === "path" && el.points.length <= 2) return;

    commitElement(finalized, true);
    if (tool !== "pen") setTool("select");
  }, [draft, creationBox, color, commitElement, requestLock, tool, relativePointer, hitTest, scene.elements]);

  // --- Wheel: pan, or zoom with ctrl/cmd ---
  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    if (e.evt.ctrlKey || e.evt.metaKey) {
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      setViewport((prev) => {
        const scaleBy = 1.04;
        const direction = e.evt.deltaY > 0 ? -1 : 1;
        const zoom = Math.min(
          MAX_ZOOM,
          Math.max(MIN_ZOOM, prev.zoom * (direction > 0 ? scaleBy : 1 / scaleBy))
        );
        const mousePoint = { x: (pointer.x - prev.x) / prev.zoom, y: (pointer.y - prev.y) / prev.zoom };
        return { zoom, x: pointer.x - mousePoint.x * zoom, y: pointer.y - mousePoint.y * zoom };
      });
      return;
    }

    setViewport((prev) => ({ ...prev, x: prev.x - e.evt.deltaX, y: prev.y - e.evt.deltaY }));
  }, []);

  // --- Element drag / transform commit ---
  // --- Smart snapping while dragging ---
  const handleDragMove = useCallback(
    (el: BoardElement, node: Konva.Group) => {
      if (readOnly) return;
      const lb = localBounds(el);
      const moving: Box = { x: node.x() + lb.x, y: node.y() + lb.y, w: lb.w, h: lb.h };
      const others: Box[] = [];
      for (const id of scene.elementOrder) {
        if (id === el.id) continue;
        const other = scene.elements[id];
        if (other && other.type !== "connector") others.push(absBounds(other));
      }
      const { dx, dy, lines } = computeSnap(moving, others, SNAP_THRESHOLD_PX / viewport.zoom);
      if (dx !== 0) node.x(node.x() + dx);
      if (dy !== 0) node.y(node.y() + dy);
      setGuides(lines);
    },
    [readOnly, scene.elementOrder, scene.elements, viewport.zoom]
  );

  const commitMove = useCallback(
    (el: BoardElement, node: Konva.Group) => {
      setGuides([]);
      commitElement({ ...el, x: node.x(), y: node.y() }, false);
    },
    [commitElement]
  );

  const commitTransform = useCallback(
    (el: BoardElement, node: Konva.Group) => {
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);
      const scaled = scaleElement(el, scaleX, scaleY);
      commitElement({ ...scaled, x: node.x(), y: node.y(), rotation: node.rotation() }, false);
    },
    [commitElement]
  );

  // --- Inline text editing overlay ---
  const editingEl = editingId ? scene.elements[editingId] : null;
  // Derived purely from scene coordinates + viewport so the overlay tracks the
  // element exactly. The stage origin (x=viewport.x, scale=zoom) fills the
  // (position: relative) container the textarea is absolutely positioned in, so
  // screen pos = viewport + scene * zoom.
  const editingBox = useMemo(() => {
    if (!editingEl || (editingEl.type !== "text" && editingEl.type !== "sticky")) {
      return null;
    }
    const isSticky = editingEl.type === "sticky";
    const pad = isSticky ? 12 : 0;
    return {
      left: viewport.x + (editingEl.x + pad) * viewport.zoom,
      top: viewport.y + (editingEl.y + pad) * viewport.zoom,
      width: (editingEl.w - pad * 2) * viewport.zoom,
      height: isSticky ? (editingEl.h - pad * 2) * viewport.zoom : undefined,
      fontSize: (editingEl.type === "text" ? editingEl.fontSize : 16) * viewport.zoom,
      color: editingEl.color,
      background: isSticky ? (editingEl.fill ?? "transparent") : "transparent",
      text: editingEl.text,
    };
  }, [editingEl, viewport.x, viewport.y, viewport.zoom]);

  const commitEditingText = useCallback(
    (text: string) => {
      if (!editingId) return;
      const el = scene.elements[editingId];
      if (el && (el.type === "text" || el.type === "sticky")) {
        if (text.trim() === "" && el.text.trim() === "") {
          onPatch({ deletes: [editingId] });
        } else if (text !== el.text) {
          commitElement({ ...el, text }, false);
        }
      }
      setEditingId(null);
    },
    [editingId, scene.elements, onPatch, commitElement]
  );

  // --- Image upload ---
  const handleImageFile = useCallback(
    async (file: File) => {
      const pos = relativePointer() ?? { x: viewport.x, y: viewport.y };
      const { uploadFile } = await import("@/lib/documents/upload");
      try {
        const dropX = pos.x || -viewport.x / viewport.zoom + 100;
        const dropY = pos.y || -viewport.y / viewport.zoom + 100;
        const doc = await uploadFile({ libraryId, folderId, file });
        const dims = await readImageSize(file);
        const id = newId();
        const max = 360;
        const ratio = dims.width && dims.height ? dims.height / dims.width : 0.75;
        const w = Math.min(max, dims.width || max);
        commitElement(
          {
            id,
            type: "image",
            x: dropX,
            y: dropY,
            w,
            h: w * ratio,
            src: `/api/documents/${doc.id}/raw`,
            documentId: doc.id,
          },
          true
        );
      } catch (error) {
        console.error("[board] image upload failed", error);
      }
      setTool("select");
    },
    [relativePointer, viewport, commitElement, libraryId, folderId]
  );

  const orderedElements = scene.elementOrder
    .map((id) => scene.elements[id])
    .filter((el): el is BoardElement => Boolean(el));

  const creationPreview = creationBox
    ? {
        x: creationBox.w < 0 ? creationBox.x + creationBox.w : creationBox.x,
        y: creationBox.h < 0 ? creationBox.y + creationBox.h : creationBox.y,
        w: Math.abs(creationBox.w),
        h: Math.abs(creationBox.h),
      }
    : null;

  const canDragElements = tool === "select" && !panning && !readOnly;

  const cursor = panning
    ? spaceHeld
      ? "grabbing"
      : "grab"
    : tool === "select"
      ? "default"
      : "crosshair";

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-muted/20">
      <div
        className="absolute inset-x-0 top-3 z-10 flex justify-center px-3"
        // keep clicks off the stage
      >
        <BoardToolbar
          tool={tool}
          onToolChange={(t) => {
            if (t === "image") {
              fileInputRef.current?.click();
              return;
            }
            setTool(t);
            if (t !== "select") deselect();
          }}
          color={color}
          onColorChange={(c) => {
            setColor(c);
            const el = selectedId ? scene.elements[selectedId] : null;
            if (el && !readOnly) {
              if (el.type === "text") commitElement({ ...el, color: c }, false);
              else if (
                el.type === "shape" ||
                el.type === "path" ||
                el.type === "arrow" ||
                el.type === "connector"
              )
                commitElement({ ...el, stroke: c } as BoardElement, false);
            }
          }}
          fill={fill}
          onFillChange={(f) => {
            setFill(f);
            const el = selectedId ? scene.elements[selectedId] : null;
            if (el && !readOnly && (el.type === "shape" || el.type === "sticky")) {
              commitElement({ ...el, fill: f } as BoardElement, false);
            }
          }}
          strokeWidth={strokeWidth}
          onStrokeChange={(w) => {
            setStrokeWidth(w);
            const el = selectedId ? scene.elements[selectedId] : null;
            if (
              el &&
              !readOnly &&
              (el.type === "shape" ||
                el.type === "path" ||
                el.type === "arrow" ||
                el.type === "connector")
            ) {
              commitElement({ ...el, strokeWidth: w } as BoardElement, false);
            }
          }}
          hasSelection={Boolean(selectedId)}
          onBringToFront={() => reorderSelected("front")}
          onSendToBack={() => reorderSelected("back")}
          onDelete={deleteSelected}
          disabled={readOnly}
        />
      </div>

      {denied && (
        <div className="absolute left-1/2 top-20 z-10 -translate-x-1/2 rounded-full border border-border bg-popover px-3 py-1.5 text-xs shadow-md">
          <span
            className="mr-1.5 inline-block size-2 rounded-full align-middle"
            style={{ backgroundColor: denied.color }}
          />
          {denied.name} is editing this
        </div>
      )}

      {size.width > 0 && (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          x={viewport.x}
          y={viewport.y}
          scaleX={viewport.zoom}
          scaleY={viewport.zoom}
          draggable={panning}
          onWheel={handleWheel}
          onMouseDown={handleStageMouseDown}
          onMouseMove={handleStageMouseMove}
          onMouseUp={handleStageMouseUp}
          onMouseLeave={() => publishCursor(null)}
          onDragEnd={(e) => {
            if (e.target === stageRef.current) {
              setViewport((prev) => ({ ...prev, x: e.target.x(), y: e.target.y() }));
            }
          }}
          style={{ cursor }}
        >
          <Layer>
            {orderedElements.map((el) =>
              el.type === "connector" ? (
                <ConnectorNode
                  key={el.id}
                  connector={el}
                  points={resolveConnector(el, scene.elements)}
                  lockedBy={remoteLocks[el.id] ?? null}
                  listening={tool === "select" && !panning}
                  onSelect={() => {
                    if (tool === "select" && !panning) void selectElement(el.id);
                  }}
                />
              ) : (
                <ElementNode
                  key={el.id}
                  element={el}
                  lockedBy={remoteLocks[el.id] ?? null}
                  draggable={canDragElements && !remoteLocks[el.id]}
                  onRef={(node) => {
                    if (node) nodeMap.current.set(el.id, node);
                    else nodeMap.current.delete(el.id);
                  }}
                  onSelect={() => {
                    if (tool === "select" && !panning) void selectElement(el.id);
                  }}
                  onDblClick={() => {
                    if (readOnly || remoteLocks[el.id]) return;
                    if (el.type === "text" || el.type === "sticky") {
                      setSelectedId(el.id);
                      setEditingId(el.id);
                      void requestLock([el.id]);
                    }
                  }}
                  onDragMove={(node) => handleDragMove(el, node)}
                  onDragEnd={(node) => commitMove(el, node)}
                  onTransformEnd={(node) => commitTransform(el, node)}
                  hideText={editingId === el.id}
                />
              )
            )}

            {draft &&
              (draft.type === "connector" ? (
                <ConnectorNode
                  connector={draft}
                  points={resolveConnector(draft, scene.elements)}
                  lockedBy={null}
                  preview
                />
              ) : (
                <ElementNode element={draft} lockedBy={null} draggable={false} preview />
              ))}

            {creationPreview && (
              <Rect
                x={creationPreview.x}
                y={creationPreview.y}
                width={creationPreview.w}
                height={creationPreview.h}
                fill={tool === "sticky" ? STICKY_FILL : undefined}
                opacity={tool === "sticky" ? 0.6 : 1}
                stroke="#3b82f6"
                strokeWidth={1}
                dash={[4, 4]}
                strokeScaleEnabled={false}
                listening={false}
              />
            )}

            {guides.map((g, i) => (
              <Line
                key={`guide-${i}`}
                points={
                  g.axis === "x"
                    ? [g.pos, g.from, g.pos, g.to]
                    : [g.from, g.pos, g.to, g.pos]
                }
                stroke="#ec4899"
                strokeWidth={1}
                dash={[4, 4]}
                listening={false}
                strokeScaleEnabled={false}
              />
            ))}

            <Transformer
              ref={trRef}
              rotateEnabled
              ignoreStroke
              flipEnabled={false}
              boundBoxFunc={(oldBox, newBox) =>
                newBox.width < 5 || newBox.height < 5 ? oldBox : newBox
              }
            />
          </Layer>
        </Stage>
      )}

      {remoteCursors.map((c) => (
        <div
          key={c.userId}
          className="pointer-events-none absolute z-20 will-change-transform"
          style={{
            left: viewport.x + c.x * viewport.zoom,
            top: viewport.y + c.y * viewport.zoom,
          }}
        >
          <svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill={c.color}
            stroke="#fff"
            strokeWidth={1.5}
            className="drop-shadow-sm"
          >
            <path d="M5 3l14 7-6 1.5L9 18 5 3z" />
          </svg>
          <span
            className="absolute left-3.5 top-3.5 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium text-white shadow-sm"
            style={{ backgroundColor: c.color }}
          >
            {c.name}
          </span>
        </div>
      ))}

      {editingBox && (
        <textarea
          autoFocus
          defaultValue={editingBox.text}
          onBlur={(e) => commitEditingText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              (e.target as HTMLTextAreaElement).blur();
            }
            if (e.key === "Enter" && !e.shiftKey && editingEl?.type === "text") {
              e.preventDefault();
              (e.target as HTMLTextAreaElement).blur();
            }
          }}
          className="absolute z-20 resize-none overflow-hidden border-0 p-0 leading-tight outline-none"
          style={{
            left: editingBox.left,
            top: editingBox.top,
            width: Math.max(40, editingBox.width),
            height: editingBox.height,
            fontSize: editingBox.fontSize,
            lineHeight: 1.2,
            color: editingBox.color,
            background: editingBox.background,
            fontFamily:
              "Arial, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          }}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImageFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function ConnectorNode({
  connector,
  points,
  lockedBy,
  listening,
  onSelect,
  preview,
}: {
  connector: ConnectorElement;
  points: [number, number, number, number] | null;
  lockedBy: LockHolder | null;
  listening?: boolean;
  onSelect?: () => void;
  preview?: boolean;
}) {
  if (!points) return null;
  return (
    <>
      {lockedBy && (
        <Line
          points={points}
          stroke={lockedBy.color}
          strokeWidth={connector.strokeWidth + 6}
          opacity={0.35}
          lineCap="round"
          listening={false}
          strokeScaleEnabled={false}
        />
      )}
      <Arrow
        points={points}
        stroke={connector.stroke}
        fill={connector.stroke}
        strokeWidth={connector.strokeWidth}
        pointerLength={10}
        pointerWidth={10}
        hitStrokeWidth={16}
        listening={!preview && !lockedBy && Boolean(listening)}
        onMouseDown={onSelect}
        onTap={onSelect}
      />
      {lockedBy && (
        <Label x={points[0]} y={points[1] - 22}>
          <Tag fill={lockedBy.color} cornerRadius={3} />
          <KonvaText text={lockedBy.name} fontSize={11} fill="#fff" padding={4} />
        </Label>
      )}
    </>
  );
}

function ElementNode({
  element,
  lockedBy,
  draggable,
  onRef,
  onSelect,
  onDblClick,
  onDragMove,
  onDragEnd,
  onTransformEnd,
  hideText,
  preview,
}: {
  element: BoardElement;
  lockedBy: LockHolder | null;
  draggable: boolean;
  onRef?: (node: Konva.Group | null) => void;
  onSelect?: () => void;
  onDblClick?: () => void;
  onDragMove?: (node: Konva.Group) => void;
  onDragEnd?: (node: Konva.Group) => void;
  onTransformEnd?: (node: Konva.Group) => void;
  hideText?: boolean;
  preview?: boolean;
}) {
  const el = element;
  const bounds = localBounds(el);

  return (
    <Group
      ref={onRef}
      x={el.x}
      y={el.y}
      rotation={el.rotation ?? 0}
      opacity={el.opacity ?? 1}
      draggable={draggable}
      listening={!preview && !lockedBy}
      onMouseDown={onSelect}
      onTap={onSelect}
      onDblClick={onDblClick}
      onDblTap={onDblClick}
      onDragMove={(e) => onDragMove?.(e.target as Konva.Group)}
      onDragEnd={(e) => onDragEnd?.(e.target as Konva.Group)}
      onTransformEnd={(e) => onTransformEnd?.(e.target as Konva.Group)}
    >
      {el.type === "path" && (
        <Line
          points={el.points}
          stroke={el.stroke}
          strokeWidth={el.strokeWidth}
          lineCap="round"
          lineJoin="round"
          tension={0.4}
          hitStrokeWidth={Math.max(12, el.strokeWidth + 8)}
        />
      )}

      {el.type === "arrow" && (
        <Arrow
          points={el.points}
          stroke={el.stroke}
          fill={el.stroke}
          strokeWidth={el.strokeWidth}
          pointerLength={10}
          pointerWidth={10}
          hitStrokeWidth={Math.max(12, el.strokeWidth + 8)}
        />
      )}

      {el.type === "shape" && (
        <ShapeNode
          shape={el.shape}
          w={el.w}
          h={el.h}
          fill={el.fill}
          stroke={el.stroke}
          strokeWidth={el.strokeWidth}
          cornerRadius={el.shape === "rect" ? 6 : undefined}
        />
      )}

      {el.type === "sticky" && (
        <>
          <Rect width={el.w} height={el.h} fill={el.fill} cornerRadius={4} shadowColor="#000" shadowBlur={6} shadowOpacity={0.12} shadowOffsetY={2} />
          {!hideText && (
            <KonvaText text={el.text} x={12} y={12} width={el.w - 24} fontSize={16} fill={el.color} wrap="word" />
          )}
        </>
      )}

      {el.type === "text" && !hideText && (
        <KonvaText text={el.text || " "} width={el.w} fontSize={el.fontSize} fill={el.color} wrap="word" />
      )}

      {el.type === "image" && <BoardImageNode element={el} />}

      {lockedBy && (
        <>
          <Rect
            x={bounds.x - 4}
            y={bounds.y - 4}
            width={bounds.w + 8}
            height={bounds.h + 8}
            stroke={lockedBy.color}
            strokeWidth={1.5}
            dash={[6, 4]}
            cornerRadius={4}
            listening={false}
            strokeScaleEnabled={false}
          />
          <Label x={bounds.x} y={bounds.y - 22}>
            <Tag fill={lockedBy.color} cornerRadius={3} />
            <KonvaText text={lockedBy.name} fontSize={11} fill="#fff" padding={4} />
          </Label>
        </>
      )}
    </Group>
  );
}
