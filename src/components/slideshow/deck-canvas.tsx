"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Group, Rect, Line, Transformer } from "react-konva";
import Konva from "konva";
import {
  DECK_HEIGHT,
  DECK_WIDTH,
  DEFAULT_SLIDE_BG,
  newDeckId,
  type DeckElement,
  type Slide,
} from "@/lib/decks/deck-schema";
import { scaleElement } from "@/lib/decks/deck-geometry";
import { readImageSize } from "@/lib/canvas/image";
import { ElementContent } from "@/components/slideshow/slide-konva";
import { DeckToolbar, type DeckTool } from "@/components/slideshow/deck-toolbar";
import type { ShapeKind } from "@/lib/canvas/shapes";

const MARGIN = 28;

/** Default fill per shape when first drawn on a slide. */
const SHAPE_FILLS: Partial<Record<ShapeKind, string>> = {
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

/** Normalizes a draft element (which may have negative width/height while being
 *  dragged) into positive bounds for a faithful preview. Lines keep their raw
 *  delta so the endpoint follows the pointer. */
function previewElement(el: DeckElement): DeckElement {
  if (el.type === "shape" && el.shape === "line") return el;
  if (el.type === "shape" || el.type === "text" || el.type === "image") {
    const x = el.w < 0 ? el.x + el.w : el.x;
    const y = el.h < 0 ? el.y + el.h : el.y;
    return { ...el, x, y, w: Math.abs(el.w), h: Math.abs(el.h) } as DeckElement;
  }
  return el;
}

type Props = {
  slide: Slide;
  readOnly: boolean;
  libraryId: string;
  folderId: string | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAddElement: (el: DeckElement) => void;
  onUpdateElement: (el: DeckElement) => void;
  onDeleteElement: (id: string) => void;
  onReorder: (order: string[]) => void;
  onPresent: () => void;
};

export function DeckCanvas({
  slide,
  readOnly,
  libraryId,
  folderId,
  selectedId,
  onSelect,
  onAddElement,
  onUpdateElement,
  onDeleteElement,
  onReorder,
  onPresent,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const trRef = useRef<Konva.Transformer | null>(null);
  const nodeMap = useRef<Map<string, Konva.Group>>(new Map());
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [size, setSize] = useState({ width: 0, height: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
  const [tool, setTool] = useState<DeckTool>("select");
  const [draft, setDraft] = useState<DeckElement | null>(null);

  const drawingRef = useRef(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);

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

  const scale = size.width
    ? Math.max(
        0.01,
        Math.min(
          (size.width - MARGIN * 2) / DECK_WIDTH,
          (size.height - MARGIN * 2) / DECK_HEIGHT
        )
      )
    : 0;
  const stageW = DECK_WIDTH * scale;
  const stageH = DECK_HEIGHT * scale;
  const offsetX = (size.width - stageW) / 2;
  const offsetY = (size.height - stageH) / 2;

  const selected = selectedId ? slide.elements[selectedId] ?? null : null;

  // --- Attach transformer to the selected node ---
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = selectedId && !editingId ? nodeMap.current.get(selectedId) : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, editingId, slide]);

  // Clear stale node refs when the active slide changes.
  useEffect(() => {
    nodeMap.current.clear();
    setEditingId(null);
  }, [slide.id]);

  const elements = useMemo(
    () =>
      slide.elementOrder
        .map((id) => slide.elements[id])
        .filter((el): el is DeckElement => Boolean(el)),
    [slide]
  );

  const insertElement = useCallback(
    (el: DeckElement, edit = false) => {
      onAddElement(el);
      onSelect(el.id);
      if (edit) setEditingId(el.id);
    },
    [onAddElement, onSelect]
  );

  // --- Drag-to-create (text / shapes) ---
  // A creation tool starts a draft on mouse-down, resizes it on move, and
  // commits it on mouse-up. A negligible drag (a plain click) falls back to a
  // sensible default size placed at the click point.
  const relativePointer = useCallback(() => {
    return stageRef.current?.getRelativePointerPosition() ?? null;
  }, []);

  const newDraft = useCallback(
    (id: string, pos: { x: number; y: number }): DeckElement | null => {
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
      // Any shape tool: a box-based shape drawn from the drag bounds.
      if (tool === "line") {
        return { id, type: "shape", shape: "line", x: pos.x, y: pos.y, w: 0, h: 0, stroke: "#1f2937", strokeWidth: 4 };
      }
      return {
        id,
        type: "shape",
        shape: tool,
        x: pos.x,
        y: pos.y,
        w: 0,
        h: 0,
        fill: SHAPE_FILLS[tool] ?? "#ddd6fe",
        stroke: "#1f2937",
        strokeWidth: 2,
        ...(tool === "rect" ? { radius: 8 } : {}),
      };
    },
    [tool]
  );

  const handleStageMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (tool === "select") {
        if (e.target === e.target.getStage()) onSelect(null);
        return;
      }
      if (readOnly) return;
      const pos = relativePointer();
      if (!pos) return;
      const id = newDeckId();
      const next = newDraft(id, pos);
      if (!next) return;
      drawingRef.current = true;
      startRef.current = pos;
      onSelect(null);
      setEditingId(null);
      setDraft(next);
    },
    [tool, readOnly, relativePointer, newDraft, onSelect]
  );

  const handleStageMouseMove = useCallback(() => {
    if (!drawingRef.current || !startRef.current) return;
    const pos = relativePointer();
    if (!pos) return;
    const start = startRef.current;
    setDraft((prev) => (prev ? ({ ...prev, w: pos.x - start.x, h: pos.y - start.y } as DeckElement) : prev));
  }, [relativePointer]);

  const handleStageMouseUp = useCallback(() => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    startRef.current = null;
    const el = draft;
    setDraft(null);
    if (!el) return;

    const aw = Math.abs(el.w);
    const ah = Math.abs(el.h);
    const dragged = aw > 8 || ah > 8;
    const nx = el.w < 0 ? el.x + el.w : el.x;
    const ny = el.h < 0 ? el.y + el.h : el.y;

    if (el.type === "text") {
      const w = dragged ? Math.max(60, aw) : 800;
      const fontSize = dragged && ah > 20 ? Math.max(8, Math.min(400, Math.round(ah / 1.4))) : 48;
      const h = dragged ? Math.max(fontSize * 1.2, ah) : 120;
      insertElement({ ...el, x: dragged ? nx : el.x, y: dragged ? ny : el.y, w, h, fontSize }, true);
      setTool("select");
      return;
    }

    if (el.type === "shape" && el.shape === "line") {
      const finalized = dragged ? el : { ...el, w: 400, h: 0 };
      insertElement(finalized);
      setTool("select");
      return;
    }

    const w = dragged ? aw : 400;
    const h = dragged ? ah : 240;
    insertElement({ ...el, x: dragged ? nx : el.x, y: dragged ? ny : el.y, w, h });
    setTool("select");
  }, [draft, insertElement]);

  const updateSelected = useCallback(
    (patch: Partial<DeckElement>) => {
      if (!selected) return;
      onUpdateElement({ ...selected, ...patch } as DeckElement);
    },
    [selected, onUpdateElement]
  );

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    onDeleteElement(selectedId);
    onSelect(null);
    setEditingId(null);
  }, [selectedId, onDeleteElement, onSelect]);

  const duplicateSelected = useCallback(() => {
    if (!selected) return;
    const id = newDeckId();
    const copy = { ...selected, id, x: selected.x + 24, y: selected.y + 24 } as DeckElement;
    onAddElement(copy);
    onSelect(id);
  }, [selected, onAddElement, onSelect]);

  // --- Clipboard (in-app copy/paste) ---
  const clipboardRef = useRef<DeckElement | null>(null);
  const copySelected = useCallback(() => {
    if (selected) clipboardRef.current = selected;
  }, [selected]);
  const pasteClipboard = useCallback(() => {
    const el = clipboardRef.current;
    if (!el || readOnly) return;
    const id = newDeckId();
    const copy = { ...el, id, x: el.x + 24, y: el.y + 24 } as DeckElement;
    onAddElement(copy);
    onSelect(id);
  }, [readOnly, onAddElement, onSelect]);

  const reorderSelected = useCallback(
    (to: "front" | "back") => {
      if (!selectedId) return;
      const rest = slide.elementOrder.filter((x) => x !== selectedId);
      onReorder(to === "front" ? [...rest, selectedId] : [selectedId, ...rest]);
    },
    [selectedId, slide.elementOrder, onReorder]
  );

  // --- Keyboard: delete / escape ---
  useEffect(() => {
    const isTyping = () => {
      const el = document.activeElement;
      return el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping() || editingId) return;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && !e.altKey && e.key.toLowerCase() === "c" && selectedId) {
        e.preventDefault();
        copySelected();
        return;
      }
      if (meta && !e.altKey && e.key.toLowerCase() === "v" && !readOnly) {
        e.preventDefault();
        pasteClipboard();
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId && !readOnly) {
        e.preventDefault();
        deleteSelected();
      } else if (e.key === "Escape") {
        onSelect(null);
        setTool("select");
        drawingRef.current = false;
        startRef.current = null;
        setDraft(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId, editingId, readOnly, deleteSelected, onSelect, copySelected, pasteClipboard]);

  // --- Snapping (drag) ---
  // While dragging, nudge the element so its edges/center align with the slide
  // edges/center or with another element's edges/center, and draw guide lines.
  const SNAP = scale ? 6 / scale : 6;
  const handleDragMove = useCallback(
    (el: DeckElement, node: Konva.Group) => {
      const w = Math.abs(el.w);
      const h = Math.abs(el.h);

      const targetsV = [0, DECK_WIDTH / 2, DECK_WIDTH];
      const targetsH = [0, DECK_HEIGHT / 2, DECK_HEIGHT];
      for (const other of elements) {
        if (other.id === el.id) continue;
        const ow = Math.abs(other.w);
        const oh = Math.abs(other.h);
        targetsV.push(other.x, other.x + ow / 2, other.x + ow);
        targetsH.push(other.y, other.y + oh / 2, other.y + oh);
      }

      // [edge value, offset of that edge from the box's top-left]
      const px: [number, number][] = [
        [node.x(), 0],
        [node.x() + w / 2, w / 2],
        [node.x() + w, w],
      ];
      const py: [number, number][] = [
        [node.y(), 0],
        [node.y() + h / 2, h / 2],
        [node.y() + h, h],
      ];

      let bestV: { d: number; line: number; pos: number } | null = null;
      for (const [val, off] of px) {
        for (const t of targetsV) {
          const d = Math.abs(val - t);
          if (d <= SNAP && (!bestV || d < bestV.d)) bestV = { d, line: t, pos: t - off };
        }
      }
      let bestH: { d: number; line: number; pos: number } | null = null;
      for (const [val, off] of py) {
        for (const t of targetsH) {
          const d = Math.abs(val - t);
          if (d <= SNAP && (!bestH || d < bestH.d)) bestH = { d, line: t, pos: t - off };
        }
      }

      if (bestV) node.x(bestV.pos);
      if (bestH) node.y(bestH.pos);
      setGuides({ v: bestV ? [bestV.line] : [], h: bestH ? [bestH.line] : [] });
    },
    [elements, SNAP]
  );

  // --- Drag / transform commit ---
  const commitMove = useCallback(
    (el: DeckElement, node: Konva.Group) => {
      setGuides({ v: [], h: [] });
      onUpdateElement({ ...el, x: node.x(), y: node.y() });
    },
    [onUpdateElement]
  );

  const commitTransform = useCallback(
    (el: DeckElement, node: Konva.Group) => {
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);
      const scaled = scaleElement(el, scaleX, scaleY);
      onUpdateElement({ ...scaled, x: node.x(), y: node.y(), rotation: node.rotation() });
    },
    [onUpdateElement]
  );

  // --- Inline text editing overlay ---
  const editingEl = editingId ? slide.elements[editingId] : null;
  const editingBox = useMemo(() => {
    if (!editingEl || editingEl.type !== "text") return null;
    return {
      left: offsetX + editingEl.x * scale,
      top: offsetY + editingEl.y * scale,
      width: editingEl.w * scale,
      fontSize: editingEl.fontSize * scale,
      color: editingEl.color,
      align: editingEl.align ?? "left",
      bold: (editingEl.fontWeight ?? 400) >= 600,
      italic: Boolean(editingEl.italic),
      fontFamily: editingEl.fontFamily || "Arial",
      text: editingEl.text,
    };
  }, [editingEl, offsetX, offsetY, scale]);

  const commitEditingText = useCallback(
    (text: string) => {
      if (!editingId) return;
      const el = slide.elements[editingId];
      if (el && el.type === "text" && text !== el.text) {
        onUpdateElement({ ...el, text });
      }
      setEditingId(null);
    },
    [editingId, slide.elements, onUpdateElement]
  );

  // --- Image upload ---
  const handleImageFile = useCallback(
    async (file: File) => {
      const { uploadFile } = await import("@/lib/documents/upload");
      try {
        const doc = await uploadFile({ libraryId, folderId, file });
        const dims = await readImageSize(file);
        const ratio = dims.width && dims.height ? dims.height / dims.width : 0.6;
        const w = Math.min(560, dims.width || 560);
        const h = w * ratio;
        const id = newDeckId();
        insertElement({
          id,
          type: "image",
          x: (DECK_WIDTH - w) / 2,
          y: (DECK_HEIGHT - h) / 2,
          w,
          h,
          src: `/api/documents/${doc.id}/raw`,
          documentId: doc.id,
        });
      } catch (error) {
        console.error("[deck] image upload failed", error);
      }
    },
    [libraryId, folderId, insertElement]
  );

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-muted/30">
      {!readOnly && (
        <div className="absolute inset-x-0 top-3 z-10 flex justify-center px-3">
          <DeckToolbar
            selected={selected}
            disabled={readOnly}
            tool={tool}
            onToolChange={(t) => {
              setTool(t);
              if (t !== "select") {
                onSelect(null);
                setEditingId(null);
              }
            }}
            onAddImage={() => fileInputRef.current?.click()}
            onUpdate={updateSelected}
            onBringToFront={() => reorderSelected("front")}
            onSendToBack={() => reorderSelected("back")}
            onDuplicate={duplicateSelected}
            onDelete={deleteSelected}
            onPresent={onPresent}
          />
        </div>
      )}
      {readOnly && (
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

      {size.width > 0 && scale > 0 && (
        <div
          className="absolute shadow-xl"
          style={{
            left: offsetX,
            top: offsetY,
            width: stageW,
            height: stageH,
            cursor: tool === "select" ? "default" : "crosshair",
          }}
        >
          <Stage
            ref={stageRef}
            width={stageW}
            height={stageH}
            scaleX={scale}
            scaleY={scale}
            onMouseDown={handleStageMouseDown}
            onMouseMove={handleStageMouseMove}
            onMouseUp={handleStageMouseUp}
          >
            <Layer>
              <Rect
                x={0}
                y={0}
                width={DECK_WIDTH}
                height={DECK_HEIGHT}
                fill={slide.background ?? DEFAULT_SLIDE_BG}
                onMouseDown={() => onSelect(null)}
              />
              {elements.map((el) => (
                <Group
                  key={el.id}
                  ref={(node) => {
                    if (node) nodeMap.current.set(el.id, node);
                    else nodeMap.current.delete(el.id);
                  }}
                  x={el.x}
                  y={el.y}
                  rotation={el.rotation ?? 0}
                  opacity={el.opacity ?? 1}
                  draggable={!readOnly && tool === "select"}
                  onMouseDown={() => {
                    if (tool === "select") onSelect(el.id);
                  }}
                  onTap={() => {
                    if (tool === "select") onSelect(el.id);
                  }}
                  onDblClick={() => {
                    if (!readOnly && el.type === "text") {
                      onSelect(el.id);
                      setEditingId(el.id);
                    }
                  }}
                  onDblTap={() => {
                    if (!readOnly && el.type === "text") {
                      onSelect(el.id);
                      setEditingId(el.id);
                    }
                  }}
                  onDragMove={(e) => handleDragMove(el, e.target as Konva.Group)}
                  onDragEnd={(e) => commitMove(el, e.target as Konva.Group)}
                  onTransformEnd={(e) => commitTransform(el, e.target as Konva.Group)}
                >
                  <ElementContent el={el} hideText={editingId === el.id} />
                </Group>
              ))}

              {draft &&
                (() => {
                  const p = previewElement(draft);
                  const showBox = !(p.type === "shape" && p.shape === "line");
                  return (
                    <>
                      <Group x={p.x} y={p.y} opacity={0.75} listening={false}>
                        <ElementContent el={p} />
                      </Group>
                      {showBox && (
                        <Rect
                          x={p.x}
                          y={p.y}
                          width={Math.abs(p.w)}
                          height={Math.abs(p.h)}
                          stroke="#3b82f6"
                          strokeWidth={1 / scale}
                          dash={[6 / scale, 4 / scale]}
                          listening={false}
                        />
                      )}
                    </>
                  );
                })()}

              {guides.v.map((x, i) => (
                <Line
                  key={`gv-${i}`}
                  points={[x, 0, x, DECK_HEIGHT]}
                  stroke="#f43f5e"
                  strokeWidth={1 / scale}
                  dash={[6 / scale, 4 / scale]}
                  listening={false}
                />
              ))}
              {guides.h.map((y, i) => (
                <Line
                  key={`gh-${i}`}
                  points={[0, y, DECK_WIDTH, y]}
                  stroke="#f43f5e"
                  strokeWidth={1 / scale}
                  dash={[6 / scale, 4 / scale]}
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
      )}

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
          }}
          className="absolute z-20 resize-none overflow-hidden border-0 bg-transparent p-0 outline-none"
          style={{
            left: editingBox.left,
            top: editingBox.top,
            width: Math.max(40, editingBox.width),
            fontSize: editingBox.fontSize,
            lineHeight: 1.2,
            color: editingBox.color,
            textAlign: editingBox.align,
            fontWeight: editingBox.bold ? 700 : 400,
            fontStyle: editingBox.italic ? "italic" : "normal",
            fontFamily: editingBox.fontFamily,
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
