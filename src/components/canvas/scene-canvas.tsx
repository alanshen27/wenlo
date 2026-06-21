"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import type { ConnectorEndpoint, SceneElement } from "@/lib/scene/elements";
import { isDeckElement, usesEndpointHandles } from "@/lib/scene/elements";
import type { SceneDoc, ScenePatch } from "@/lib/scene/scene-schema";
import { newSceneId } from "@/lib/scene/scene-schema";
import {
  absBounds,
  computeSnap,
  computeSnapWithCanvas,
  localBounds,
  resolveConnector,
  scaleElement,
  type Box,
  type SnapLine,
} from "@/lib/scene/scene-geometry";
import { BULLET_CHAR, formatTextForEdit, parseTextFromEdit } from "@/lib/scene/text-list";
import { BOARD_SCENE_CONFIG, DECK_HEIGHT, DECK_SCENE_CONFIG, DECK_WIDTH, DEFAULT_SLIDE_BG } from "@/lib/scene/scene-config";
import type { SceneCanvasConfig } from "@/lib/scene/scene-config";
import type { ShapeKind } from "@/lib/canvas/shapes";
import { readImageSize } from "@/lib/canvas/image";
import {
  SceneConnectorNode,
  SceneElementContent,
  SceneElementNode,
} from "@/components/canvas/scene-element-content";
import { SceneEndpointHandles } from "@/components/canvas/scene-endpoint-handles";
import { DeckToolbar, type DeckTool } from "@/components/slideshow/deck-toolbar";
import { BoardToolbar, type Tool } from "@/components/whiteboard/board-toolbar";
import type { LockHolder, LockMap, RemoteCursor } from "@/components/whiteboard/use-board-collab";
import { RemoteUserCaretLayer } from "@/components/native/remote-user-caret";

/** Grow a textarea to fit its content (used for sticky + text inline edit). */
function fitTextareaHeight(ta: HTMLTextAreaElement) {
  ta.style.height = "0px";
  ta.style.height = `${ta.scrollHeight}px`;
}

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 5;
const STICKY_FILL = "#fde68a";

type Viewport = { x: number; y: number; zoom: number };

const newId = newSceneId;

export type SceneCanvasHandle = { exportPng: () => string | null };
export type BoardCanvasHandle = SceneCanvasHandle;

const DECK_SHAPE_FILLS: Partial<Record<ShapeKind, string>> = {
  rect: "#bfdbfe",
  ellipse: "#bbf7d0",
  triangle: "#fde68a",
  diamond: "#fbcfe8",
  pentagon: "#ddd6fe",
  hexagon: "#bae6fd",
  octagon: "#c7d2fe",
  star: "#fde68a",
  rightArrow: "#a7f3d0",
};

function previewDeckElement(el: SceneElement): SceneElement {
  if (el.type === "arrow" || el.type === "connector") return el;
  if (el.type === "shape" && el.shape === "line") return el;
  if (el.type === "shape" || el.type === "text" || el.type === "image") {
    const x = el.w < 0 ? el.x + el.w : el.x;
    const y = el.h < 0 ? el.y + el.h : el.y;
    return { ...el, x, y, w: Math.abs(el.w), h: Math.abs(el.h) };
  }
  return el;
}

const noopLocks = async () => ({ granted: [] as string[], denied: [] as { elementId: string; holder: LockHolder }[] });
const noopRelease = () => {};
const noopCursor = () => {};

export type SceneCanvasProps = {
  config?: SceneCanvasConfig;
  scene: SceneDoc;
  background?: string;
  readOnly: boolean;
  libraryId: string;
  folderId: string | null;
  onPatch: (patch: ScenePatch) => void;
  /** Deck: selection owned by parent. Board: optional internal fallback. */
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  remoteLocks?: LockMap;
  remoteCursors?: RemoteCursor[];
  requestLock?: (ids: string[]) => Promise<{ granted: string[]; denied: { elementId: string; holder: LockHolder }[] }>;
  releaseLock?: (ids: string[]) => void;
  publishCursor?: (pos: { x: number; y: number } | null) => void;
  registerHandle?: (handle: SceneCanvasHandle | null) => void;
  onPresent?: () => void;
  /** When this changes (e.g. active slide id), reset transient editor state. */
  sceneKey?: string;
};

const CURSOR_THROTTLE_MS = 45;
/** Distance (screen px) within which a dragged element snaps to another's edge/center. */
const SNAP_THRESHOLD_PX = 6;
/** Minimum travel (scene units) before a new pen point is recorded — bounds path size. */
const MIN_PEN_DISTANCE = 1.5;

export function SceneCanvas({
  config = BOARD_SCENE_CONFIG,
  scene,
  background,
  readOnly,
  libraryId,
  folderId,
  selectedId: selectedIdProp,
  onSelect: onSelectProp,
  remoteLocks = {},
  remoteCursors = [],
  onPatch,
  requestLock = noopLocks,
  releaseLock = noopRelease,
  publishCursor = noopCursor,
  registerHandle,
  onPresent,
  sceneKey,
}: SceneCanvasProps) {
  const isDeck = config.profile === "deck";
  const fixedViewport = config.viewport.kind === "fixed" ? config.viewport : null;
  const isFixed = fixedViewport !== null;
  const fixedW = fixedViewport?.width ?? DECK_WIDTH;
  const fixedH = fixedViewport?.height ?? DECK_HEIGHT;
  const margin = fixedViewport?.margin ?? 28;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const trRef = useRef<Konva.Transformer | null>(null);
  const nodeMap = useRef<Map<string, Konva.Group>>(new Map());
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [size, setSize] = useState({ width: 0, height: 0 });
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [tool, setTool] = useState<Tool | DeckTool>("select");
  const [deckGuides, setDeckGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
  const [color, setColor] = useState("#1f2937");
  const [fill, setFill] = useState<string>("transparent");
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const selectedId = selectedIdProp !== undefined ? selectedIdProp : internalSelectedId;
  const setSelectedId = useCallback(
    (id: string | null) => {
      if (onSelectProp) onSelectProp(id);
      else setInternalSelectedId(id);
    },
    [onSelectProp]
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SceneElement | null>(null);
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
    if (!registerHandle) return;
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

  useEffect(() => {
    nodeMap.current.clear();
    setEditingId(null);
    setDraft(null);
    setCreationBox(null);
    drawingRef.current = false;
    startRef.current = null;
  }, [sceneKey]);

  // --- Attach transformer to the selected node (box elements only) ---
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const el = selectedId ? scene.elements[selectedId] : null;
    const useHandles = el && usesEndpointHandles(el);
    const node = selectedId && !editingId && !useHandles ? nodeMap.current.get(selectedId) : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, editingId, scene]);

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
    if (!isDeck && selectedId) releaseLock([selectedId]);
    setSelectedId(null);
  }, [isDeck, selectedId, releaseLock, setSelectedId]);

  const commitElement = useCallback(
    (el: SceneElement, append: boolean) => {
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
    setEditingId(null);
    if (isDeck) {
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
      return;
    }
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
  }, [isDeck, selectedId, scene.elementOrder, scene.elements, onPatch, releaseLock, setSelectedId]);

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
  const clipboardRef = useRef<SceneElement | null>(null);
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
    const copy = { ...el, id, x: el.x + 24, y: el.y + 24 } as SceneElement;
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
      if (!isDeck && e.code === "Space" && !isTyping()) {
        setSpaceHeld(true);
        return;
      }
      if (isTyping() || editingId) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId && !readOnly) {
        e.preventDefault();
        deleteSelected();
        return;
      }
      if (
        !isDeck &&
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
      if (isDeck) {
        if (e.key === "Escape") {
          setSelectedId(null);
          setTool("select");
          drawingRef.current = false;
          startRef.current = null;
          setDraft(null);
        }
        if (!readOnly && !e.metaKey && !e.ctrlKey && !e.altKey) {
          const map: Record<string, DeckTool> = {
            a: "arrow",
            c: "connector",
            l: "line",
            t: "text",
            v: "select",
          };
          const next = map[e.key.toLowerCase()];
          if (next) setTool(next);
        }
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
  }, [isDeck, selectedId, editingId, readOnly, deleteSelected, scene.elements, onPatch, copySelected, pasteClipboard, setSelectedId]);

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

  const panning = !isDeck && (tool === "pan" || spaceHeld);

  const fitScale =
    isFixed && size.width
      ? Math.max(
          0.01,
          Math.min((size.width - margin * 2) / fixedW, (size.height - margin * 2) / fixedH)
        )
      : 0;
  const fixedStageW = fixedW * fitScale;
  const fixedStageH = fixedH * fitScale;
  const offsetX = isFixed ? (size.width - fixedStageW) / 2 : 0;
  const offsetY = isFixed ? (size.height - fixedStageH) / 2 : 0;
  const deckSnap = fitScale ? 6 / fitScale : 6;

  const selected = selectedId ? scene.elements[selectedId] ?? null : null;

  const pickElement = useCallback(
    (id: string) => {
      if (isDeck) {
        setSelectedId(id);
        return;
      }
      void selectElement(id);
    },
    [isDeck, setSelectedId, selectElement]
  );

  const insertDeckElement = useCallback(
    (el: SceneElement, edit = false) => {
      commitElement(el, true);
      setSelectedId(el.id);
      if (edit) setEditingId(el.id);
    },
    [commitElement, setSelectedId]
  );

  const updateSelected = useCallback(
    (patch: Partial<SceneElement>) => {
      if (!selected) return;
      commitElement({ ...selected, ...patch } as SceneElement, false);
    },
    [selected, commitElement]
  );

  const duplicateSelected = useCallback(() => {
    if (!selected) return;
    const id = newId();
    const copy = { ...selected, id, x: selected.x + 24, y: selected.y + 24 } as SceneElement;
    insertDeckElement(copy);
  }, [selected, insertDeckElement]);

  const newDeckDraft = useCallback(
    (id: string, pos: { x: number; y: number }): SceneElement | null => {
      if (tool === "select") return null;
      if (tool === "text") {
        return {
          id,
          type: "text",
          x: pos.x,
          y: pos.y,
          w: 0,
          h: 0,
          text: "Text",
          fontSize: 48,
          fontFamily: "Arial",
          fontWeight: 400,
          color: "#1f2937",
          align: "left",
        };
      }
      if (tool === "line") {
        return {
          id,
          type: "shape",
          shape: "line",
          x: pos.x,
          y: pos.y,
          w: 0,
          h: 0,
          stroke: "#1f2937",
          strokeWidth: 4,
        };
      }
      const shape = tool as ShapeKind;
      return {
        id,
        type: "shape",
        shape,
        x: pos.x,
        y: pos.y,
        w: 0,
        h: 0,
        fill: DECK_SHAPE_FILLS[shape] ?? "#ddd6fe",
        stroke: "#1f2937",
        strokeWidth: 2,
        ...(shape === "rect" ? { radius: 8 } : {}),
      };
    },
    [tool]
  );

  const handleStageMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (isDeck) {
        if (tool === "select") {
          if (e.target === e.target.getStage()) setSelectedId(null);
          return;
        }
        if (readOnly) return;
        const pos = relativePointer();
        if (!pos) return;

        if (tool === "arrow" || tool === "connector") {
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
          } else {
            setDraft({ id, type: "arrow", x: pos.x, y: pos.y, points: [0, 0, 0, 0], stroke: color, strokeWidth });
          }
          setSelectedId(null);
          setEditingId(null);
          return;
        }

        const id = newId();
        const next = newDeckDraft(id, pos);
        if (!next) return;
        drawingRef.current = true;
        startRef.current = pos;
        setSelectedId(null);
        setEditingId(null);
        setDraft(next);
        return;
      }

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
    [isDeck, panning, tool, readOnly, deselect, relativePointer, color, fill, strokeWidth, hitTest, newDeckDraft, setSelectedId]
  );

  const handleStageMouseMove = useCallback(() => {
    const pos = relativePointer();

    if (!isDeck && pos) {
      const now = Date.now();
      if (now - lastCursorSentRef.current > CURSOR_THROTTLE_MS) {
        lastCursorSentRef.current = now;
        publishCursor(pos);
      }
    }

    if (isDeck) {
      if (!drawingRef.current || !startRef.current) return;
      const start = startRef.current;
      if (!pos) return;
      setDraft((prev) => {
        if (!prev) return prev;
        if (prev.type === "arrow") {
          return { ...prev, points: [0, 0, pos.x - start.x, pos.y - start.y] };
        }
        if (prev.type === "connector") {
          return { ...prev, end: { kind: "point", x: pos.x, y: pos.y } };
        }
        return { ...prev, w: pos.x - start.x, h: pos.y - start.y } as SceneElement;
      });
      return;
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
      return { ...prev, w: pos.x - start.x, h: pos.y - start.y } as SceneElement;
    });
  }, [isDeck, relativePointer, publishCursor, tool]);

  const handleStageMouseUp = useCallback(() => {
    if (isDeck) {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      startRef.current = null;
      const el = draft;
      setDraft(null);

      if (el?.type === "connector") {
        const pos = relativePointer();
        const endHit = pos ? hitTest(pos) : null;
        const end: ConnectorEndpoint = endHit
          ? { kind: "element", elementId: endHit }
          : pos
            ? { kind: "point", x: pos.x, y: pos.y }
            : el.end;
        const sameElement =
          el.start.kind === "element" && end.kind === "element" && el.start.elementId === end.elementId;
        const resolved = resolveConnector({ ...el, end }, scene.elements);
        const tooShort =
          !resolved ||
          (Math.abs(resolved[0] - resolved[2]) < 4 && Math.abs(resolved[1] - resolved[3]) < 4);
        if (!sameElement && !tooShort) {
          insertDeckElement({ ...el, end }, false);
        }
        setTool("select");
        return;
      }

      if (el?.type === "arrow") {
        const tooShort =
          Math.abs(el.points[2]) < 4 && Math.abs(el.points[3]) < 4;
        if (!tooShort) insertDeckElement(el, false);
        setTool("select");
        return;
      }

      if (!el || (el.type !== "text" && el.type !== "shape")) return;

      const aw = Math.abs(el.w);
      const ah = Math.abs(el.h);
      const dragged = aw > 8 || ah > 8;
      const nx = el.w < 0 ? el.x + el.w : el.x;
      const ny = el.h < 0 ? el.y + el.h : el.y;

      if (el.type === "text") {
        const w = dragged ? Math.max(60, aw) : 800;
        const fontSize = dragged && ah > 20 ? Math.max(8, Math.min(400, Math.round(ah / 1.4))) : 48;
        const h = dragged ? Math.max(fontSize * 1.2, ah) : 120;
        insertDeckElement(
          { ...el, x: dragged ? nx : el.x, y: dragged ? ny : el.y, w, h, fontSize },
          true
        );
        setTool("select");
        return;
      }

      if (el.type === "shape" && el.shape === "line") {
        insertDeckElement(dragged ? el : { ...el, w: 400, h: 0 });
        setTool("select");
        return;
      }

      if (el.type === "shape") {
        const w = dragged ? aw : 400;
        const h = dragged ? ah : 240;
        insertDeckElement({ ...el, x: dragged ? nx : el.x, y: dragged ? ny : el.y, w, h });
        setTool("select");
      }
      return;
    }

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
      let el: SceneElement;
      if (tool === "text") {
        const w = dragged ? Math.max(40, aw) : 220;
        const fontSize = dragged && ah > 16 ? Math.max(12, Math.min(240, Math.round(ah / 1.3))) : 24;
        el = { id, type: "text", x: dragged ? nx : box.x, y: dragged ? ny : box.y, text: "", w, h: fontSize * 1.4, fontSize, color };
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
  }, [isDeck, draft, creationBox, color, commitElement, requestLock, tool, relativePointer, hitTest, scene.elements, insertDeckElement]);

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
    (el: SceneElement, node: Konva.Group) => {
      if (readOnly || el.type === "connector") return;

      const lb = localBounds(el);
      const moving: Box = { x: node.x() + lb.x, y: node.y() + lb.y, w: lb.w, h: lb.h };
      const others: Box[] = [];
      for (const id of scene.elementOrder) {
        if (id === el.id) continue;
        const other = scene.elements[id];
        if (other && other.type !== "connector") others.push(absBounds(other));
      }

      const threshold = isDeck ? deckSnap : SNAP_THRESHOLD_PX / viewport.zoom;
      const canvas = isDeck ? { w: fixedW, h: fixedH } : null;
      const { dx, dy, lines } = computeSnapWithCanvas(moving, others, canvas, threshold);
      if (dx !== 0) node.x(node.x() + dx);
      if (dy !== 0) node.y(node.y() + dy);

      if (isDeck) {
        setDeckGuides({
          v: lines.filter((l) => l.axis === "x").map((l) => l.pos),
          h: lines.filter((l) => l.axis === "y").map((l) => l.pos),
        });
      } else {
        setGuides(lines);
      }
    },
    [isDeck, readOnly, scene.elementOrder, scene.elements, fixedW, fixedH, deckSnap, viewport.zoom]
  );

  const commitMove = useCallback(
    (el: SceneElement, node: Konva.Group) => {
      if (isDeck) setDeckGuides({ v: [], h: [] });
      else setGuides([]);
      commitElement({ ...el, x: node.x(), y: node.y() }, false);
    },
    [isDeck, commitElement]
  );

  const commitTransform = useCallback(
    (el: SceneElement, node: Konva.Group) => {
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
    if (!editingEl || editingEl.type !== "text" && editingEl.type !== "sticky") {
      return null;
    }
    if (isDeck && editingEl.type === "text") {
      return {
        left: offsetX + editingEl.x * fitScale,
        top: offsetY + editingEl.y * fitScale,
        width: editingEl.w * fitScale,
        fontSize: editingEl.fontSize * fitScale,
        color: editingEl.color,
        align: editingEl.align ?? "left",
        bold: (editingEl.fontWeight ?? 400) >= 600,
        italic: Boolean(editingEl.italic),
        underline: Boolean(editingEl.underline),
        link: editingEl.link ?? "",
        listStyle: editingEl.listStyle ?? "none",
        fontFamily: editingEl.fontFamily || "Arial",
        text: formatTextForEdit(editingEl.text, editingEl.listStyle),
        background: "transparent",
      };
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
      ...(editingEl.type === "text"
        ? {
            align: editingEl.align ?? "left",
            bold: (editingEl.fontWeight ?? 400) >= 600,
            italic: Boolean(editingEl.italic),
            underline: Boolean(editingEl.underline),
            link: editingEl.link ?? "",
            listStyle: editingEl.listStyle ?? "none",
            text: formatTextForEdit(editingEl.text, editingEl.listStyle),
          }
        : { text: editingEl.text }),
    };
  }, [editingEl, isDeck, offsetX, offsetY, fitScale, viewport.x, viewport.y, viewport.zoom]);

  const commitEditingText = useCallback(
    (text: string, stickyHeight?: number) => {
      if (!editingId) return;
      const el = scene.elements[editingId];
      if (el && el.type === "text") {
        const parsed = parseTextFromEdit(text, el.listStyle);
        if (parsed !== el.text) commitElement({ ...el, text: parsed }, false);
        setEditingId(null);
        return;
      }
      if (el && el.type === "sticky") {
        if (text.trim() === "" && el.text.trim() === "") {
          onPatch({ deletes: [editingId] });
        } else {
          const next =
            stickyHeight != null && stickyHeight > el.h ? { ...el, h: stickyHeight } : el;
          if (text !== el.text || next !== el) {
            commitElement({ ...next, text }, false);
          }
        }
      }
      setEditingId(null);
    },
    [editingId, scene.elements, onPatch, commitElement]
  );

  const handleImageFile = useCallback(
    async (file: File) => {
      const { uploadFile } = await import("@/lib/documents/upload");
      try {
        const doc = await uploadFile({ libraryId, folderId, file });
        const dims = await readImageSize(file);
        const ratio = dims.width && dims.height ? dims.height / dims.width : isDeck ? 0.6 : 0.75;
        const maxW = isDeck ? 560 : 360;
        const w = Math.min(maxW, dims.width || maxW);
        const h = w * ratio;
        const id = newId();
        if (isDeck) {
          insertDeckElement({
            id,
            type: "image",
            x: (fixedW - w) / 2,
            y: (fixedH - h) / 2,
            w,
            h,
            src: `/api/documents/${doc.id}/raw`,
            documentId: doc.id,
          });
        } else {
          const pos = relativePointer() ?? { x: viewport.x, y: viewport.y };
          const dropX = pos.x || -viewport.x / viewport.zoom + 100;
          const dropY = pos.y || -viewport.y / viewport.zoom + 100;
          commitElement(
            {
              id,
              type: "image",
              x: dropX,
              y: dropY,
              w,
              h,
              src: `/api/documents/${doc.id}/raw`,
              documentId: doc.id,
            },
            true
          );
        }
      } catch (error) {
        console.error("[scene] image upload failed", error);
      }
      setTool("select");
    },
    [isDeck, fixedW, fixedH, relativePointer, viewport, commitElement, insertDeckElement, libraryId, folderId]
  );

  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const ta = editTextareaRef.current;
    if (ta) fitTextareaHeight(ta);
  }, [editingId, editingBox?.text, editingBox?.width, editingBox?.fontSize]);

  const orderedElements = scene.elementOrder
    .map((id) => scene.elements[id])
    .filter((el): el is SceneElement => Boolean(el));

  const snapTargetBoxes = useMemo(() => {
    const boxes: Box[] = [];
    for (const id of scene.elementOrder) {
      if (id === selectedId) continue;
      const other = scene.elements[id];
      if (other && other.type !== "connector") boxes.push(absBounds(other));
    }
    return boxes;
  }, [scene.elementOrder, scene.elements, selectedId]);

  const endpointElement =
    selectedId && tool === "select" && !readOnly
      ? scene.elements[selectedId]
      : null;
  const showEndpointHandles =
    endpointElement && usesEndpointHandles(endpointElement) && !remoteLocks[selectedId ?? ""];

  const updateEndpointElement = useCallback(
    (el: SceneElement) => commitElement(el, false),
    [commitElement]
  );

  const creationPreview = creationBox
    ? {
        x: creationBox.w < 0 ? creationBox.x + creationBox.w : creationBox.x,
        y: creationBox.h < 0 ? creationBox.y + creationBox.h : creationBox.y,
        w: Math.abs(creationBox.w),
        h: Math.abs(creationBox.h),
      }
    : null;

  const canDragElements = isDeck
    ? !readOnly && tool === "select"
    : tool === "select" && !panning && !readOnly;

  const cursor = panning
    ? spaceHeld
      ? "grabbing"
      : "grab"
    : tool === "select"
      ? "default"
      : "crosshair";

  return (
    <div ref={containerRef} className={`relative h-full w-full overflow-hidden ${isDeck ? "bg-muted/30" : "bg-muted/20"}`}>
      {!readOnly && isDeck && (
        <div className="absolute inset-x-0 top-3 z-10 flex justify-center px-3">
          <DeckToolbar
            selected={selected && isDeckElement(selected) ? selected : null}
            disabled={readOnly}
            tool={tool as DeckTool}
            onToolChange={(t) => {
              setTool(t);
              if (t !== "select") {
                setSelectedId(null);
                setEditingId(null);
              }
            }}
            onAddImage={() => fileInputRef.current?.click()}
            onUpdate={updateSelected}
            onBringToFront={() => reorderSelected("front")}
            onSendToBack={() => reorderSelected("back")}
            onDuplicate={duplicateSelected}
            onDelete={deleteSelected}
            onPresent={onPresent ?? (() => {})}
          />
        </div>
      )}
      {readOnly && isDeck && onPresent && (
        <div className="absolute inset-x-0 top-3 z-10 flex justify-center px-3">
          <button
            type="button"
            onClick={onPresent}
            className="pointer-events-auto rounded-lg border border-border bg-popover/95 px-3 py-1.5 text-sm font-medium shadow-lg backdrop-blur hover:bg-accent"
          >
            Present
          </button>
        </div>
      )}
      {!isDeck && (
      <div
        className="absolute inset-x-0 top-3 z-10 flex justify-center px-3"
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
                commitElement({ ...el, stroke: c } as SceneElement, false);
            }
          }}
          fill={fill}
          onFillChange={(f) => {
            setFill(f);
            const el = selectedId ? scene.elements[selectedId] : null;
            if (el && !readOnly && (el.type === "shape" || el.type === "sticky")) {
              commitElement({ ...el, fill: f } as SceneElement, false);
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
              commitElement({ ...el, strokeWidth: w } as SceneElement, false);
            }
          }}
          hasSelection={Boolean(selectedId)}
          selected={selected}
          onUpdateSelected={updateSelected}
          onBringToFront={() => reorderSelected("front")}
          onSendToBack={() => reorderSelected("back")}
          onDelete={deleteSelected}
          disabled={readOnly}
        />
      </div>
      )}

      {denied && !isDeck && (
        <div className="absolute left-1/2 top-20 z-10 -translate-x-1/2 rounded-full border border-border bg-popover px-3 py-1.5 text-xs shadow-md">
          <span
            className="mr-1.5 inline-block size-2 rounded-full align-middle"
            style={{ backgroundColor: denied.color }}
          />
          {denied.name} is editing this
        </div>
      )}

      {isFixed && size.width > 0 && fitScale > 0 ? (
        <div
          className="absolute shadow-xl"
          style={{
            left: offsetX,
            top: offsetY,
            width: fixedStageW,
            height: fixedStageH,
            cursor: tool === "select" ? "default" : "crosshair",
          }}
        >
          <Stage
            ref={stageRef}
            width={fixedStageW}
            height={fixedStageH}
            scaleX={fitScale}
            scaleY={fitScale}
            onMouseDown={handleStageMouseDown}
            onMouseMove={handleStageMouseMove}
            onMouseUp={handleStageMouseUp}
          >
            <Layer>
              <Rect
                x={0}
                y={0}
                width={fixedW}
                height={fixedH}
                fill={background ?? DEFAULT_SLIDE_BG}
                onMouseDown={() => setSelectedId(null)}
              />
              {orderedElements.map((el) =>
                el.type === "connector" ? (
                  <SceneConnectorNode
                    key={el.id}
                    connector={el}
                    points={resolveConnector(el, scene.elements)}
                    lockedBy={null}
                    listening={tool === "select"}
                    onSelect={() => {
                      if (tool === "select") pickElement(el.id);
                    }}
                  />
                ) : (
                  <SceneElementNode
                    key={el.id}
                    element={el}
                    lockedBy={null}
                    draggable={canDragElements}
                    onRef={(node) => {
                      if (node) nodeMap.current.set(el.id, node);
                      else nodeMap.current.delete(el.id);
                    }}
                    onSelect={() => {
                      if (tool === "select") pickElement(el.id);
                    }}
                    onDblClick={() => {
                      if (!readOnly && el.type === "text") {
                        pickElement(el.id);
                        setEditingId(el.id);
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
                  <SceneConnectorNode
                    connector={draft}
                    points={resolveConnector(draft, scene.elements)}
                    lockedBy={null}
                    preview
                  />
                ) : (
                  (() => {
                    const p = previewDeckElement(draft);
                    if (!isDeckElement(p)) return null;
                    const showBox = p.type === "shape" ? p.shape !== "line" : p.type !== "arrow";
                    return (
                      <>
                        <Group x={p.x} y={p.y} opacity={0.75} listening={false}>
                          <SceneElementContent el={p} />
                        </Group>
                        {showBox && "w" in p && (
                          <Rect
                            x={p.x}
                            y={p.y}
                            width={Math.abs(p.w)}
                            height={Math.abs(p.h)}
                            stroke="#3b82f6"
                            strokeWidth={1 / fitScale}
                            dash={[6 / fitScale, 4 / fitScale]}
                            listening={false}
                          />
                        )}
                      </>
                    );
                  })()
                ))}

              {showEndpointHandles && endpointElement && (
                <SceneEndpointHandles
                  element={endpointElement}
                  elements={scene.elements}
                  snapOthers={snapTargetBoxes}
                  snapThreshold={deckSnap}
                  scale={fitScale}
                  onGuides={(lines) =>
                    setDeckGuides({
                      v: lines.filter((l) => l.axis === "x").map((l) => l.pos),
                      h: lines.filter((l) => l.axis === "y").map((l) => l.pos),
                    })
                  }
                  onUpdate={updateEndpointElement}
                  hitTest={hitTest}
                />
              )}

              {deckGuides.v.map((x, i) => (
                <Line
                  key={`gv-${i}`}
                  points={[x, 0, x, fixedH]}
                  stroke="#f43f5e"
                  strokeWidth={1 / fitScale}
                  dash={[6 / fitScale, 4 / fitScale]}
                  listening={false}
                />
              ))}
              {deckGuides.h.map((y, i) => (
                <Line
                  key={`gh-${i}`}
                  points={[0, y, fixedW, y]}
                  stroke="#f43f5e"
                  strokeWidth={1 / fitScale}
                  dash={[6 / fitScale, 4 / fitScale]}
                  listening={false}
                />
              ))}

              {!readOnly && (
                <Transformer
                  ref={trRef}
                  rotateEnabled
                  ignoreStroke
                  flipEnabled={false}
                  boundBoxFunc={(oldBox, newBox) =>
                    newBox.width < 5 || newBox.height < 5 ? oldBox : newBox
                  }
                />
              )}
            </Layer>
          </Stage>
        </div>
      ) : !isFixed && size.width > 0 ? (
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
                <SceneConnectorNode
                  key={el.id}
                  connector={el}
                  points={resolveConnector(el, scene.elements)}
                  lockedBy={remoteLocks[el.id] ?? null}
                  listening={tool === "select" && !panning}
                  onSelect={() => {
                    if (tool === "select" && !panning) void pickElement(el.id);
                  }}
                />
              ) : (
                <SceneElementNode
                  key={el.id}
                  element={el}
                  lockedBy={remoteLocks[el.id] ?? null}
                  draggable={canDragElements && !remoteLocks[el.id]}
                  onRef={(node) => {
                    if (node) nodeMap.current.set(el.id, node);
                    else nodeMap.current.delete(el.id);
                  }}
                  onSelect={() => {
                    if (tool === "select" && !panning) void pickElement(el.id);
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
                <SceneConnectorNode
                  connector={draft}
                  points={resolveConnector(draft, scene.elements)}
                  lockedBy={null}
                  preview
                />
              ) : (
                <SceneElementNode element={draft} lockedBy={null} draggable={false} preview />
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

            {showEndpointHandles && endpointElement && (
              <SceneEndpointHandles
                element={endpointElement}
                elements={scene.elements}
                snapOthers={snapTargetBoxes}
                snapThreshold={SNAP_THRESHOLD_PX / viewport.zoom}
                scale={viewport.zoom}
                onGuides={setGuides}
                onUpdate={updateEndpointElement}
                hitTest={hitTest}
              />
            )}

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
      ) : null}

      {!isDeck && remoteCursors.length > 0 && (
        <RemoteUserCaretLayer
          cursors={remoteCursors}
          toPixels={(c) => ({
            left: viewport.x + c.x * viewport.zoom,
            top: viewport.y + c.y * viewport.zoom,
          })}
        />
      )}

      {editingBox && (
        <textarea
          ref={editTextareaRef}
          autoFocus
          defaultValue={editingBox.text}
          onInput={(e) => fitTextareaHeight(e.currentTarget)}
          onBlur={(e) => {
            const ta = e.currentTarget;
            let stickyHeight: number | undefined;
            if (editingEl?.type === "sticky") {
              const pad = 12;
              const needed = Math.ceil(ta.scrollHeight / viewport.zoom) + pad * 2;
              if (needed > editingEl.h) stickyHeight = needed;
            }
            commitEditingText(ta.value, stickyHeight);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              (e.target as HTMLTextAreaElement).blur();
              return;
            }
            const isBulletText =
              editingEl?.type === "text" && editingEl.listStyle === "bullet";
            if (e.key === "Enter" && isBulletText) {
              e.preventDefault();
              const ta = e.target as HTMLTextAreaElement;
              const { selectionStart, selectionEnd, value } = ta;
              const insert = `\n${BULLET_CHAR} `;
              ta.value = value.slice(0, selectionStart) + insert + value.slice(selectionEnd);
              const pos = selectionStart + insert.length;
              ta.selectionStart = pos;
              ta.selectionEnd = pos;
              fitTextareaHeight(ta);
              return;
            }
            if (e.key === "Enter" && !e.shiftKey && editingEl?.type === "text" && !isBulletText) {
              e.preventDefault();
              (e.target as HTMLTextAreaElement).blur();
            }
          }}
          className="absolute z-20 resize-none overflow-hidden border-0 p-0 leading-tight outline-none"
          style={{
            left: editingBox.left,
            top: editingBox.top,
            width: Math.max(40, editingBox.width),
            minHeight: "height" in editingBox ? editingBox.height : undefined,
            fontSize: editingBox.fontSize,
            lineHeight: 1.2,
            color:
              "link" in editingBox && editingBox.link ? "#2563eb" : editingBox.color,
            background: editingBox.background,
            textAlign: "align" in editingBox ? editingBox.align : undefined,
            fontWeight: "bold" in editingBox && editingBox.bold ? 700 : 400,
            fontStyle: "italic" in editingBox && editingBox.italic ? "italic" : "normal",
            textDecoration:
              "underline" in editingBox && (editingBox.underline || editingBox.link)
                ? "underline"
                : undefined,
            fontFamily:
              "fontFamily" in editingBox
                ? editingBox.fontFamily
                : "Arial, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
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

export function BoardCanvas(
  props: Omit<SceneCanvasProps, "config"> & {
    remoteLocks: LockMap;
    remoteCursors: RemoteCursor[];
    requestLock: NonNullable<SceneCanvasProps["requestLock"]>;
    releaseLock: NonNullable<SceneCanvasProps["releaseLock"]>;
    publishCursor: NonNullable<SceneCanvasProps["publishCursor"]>;
    registerHandle: NonNullable<SceneCanvasProps["registerHandle"]>;
  }
) {
  return <SceneCanvas config={BOARD_SCENE_CONFIG} {...props} />;
}

export function DeckCanvas(
  props: Omit<SceneCanvasProps, "config"> & {
    selectedId: string | null;
    onSelect: (id: string | null) => void;
    onPresent: () => void;
  }
) {
  return <SceneCanvas config={DECK_SCENE_CONFIG} {...props} />;
}

