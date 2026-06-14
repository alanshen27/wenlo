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
  type ShapeKind,
  type Slide,
} from "@/lib/decks/deck-schema";
import { scaleElement } from "@/lib/decks/deck-geometry";
import { readImageSize } from "@/lib/canvas/image";
import { ElementContent } from "@/components/slideshow/slide-konva";
import { DeckToolbar } from "@/components/slideshow/deck-toolbar";

const MARGIN = 28;

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

  const addText = useCallback(() => {
    if (readOnly) return;
    const id = newDeckId();
    insertElement(
      {
        id,
        type: "text",
        x: 240,
        y: 300,
        w: 800,
        h: 120,
        text: "Text",
        fontSize: 48,
        fontFamily: "Arial",
        fontWeight: 400,
        color: "#1f2937",
        align: "left",
      },
      true
    );
  }, [readOnly, insertElement]);

  const addShape = useCallback(
    (shape: ShapeKind) => {
      if (readOnly) return;
      const id = newDeckId();
      if (shape === "line") {
        insertElement({
          id,
          type: "shape",
          shape: "line",
          x: 440,
          y: 360,
          w: 400,
          h: 0,
          stroke: "#1f2937",
          strokeWidth: 4,
        });
        return;
      }
      insertElement({
        id,
        type: "shape",
        shape,
        x: 440,
        y: 240,
        w: 400,
        h: 240,
        fill: shape === "rect" ? "#bfdbfe" : "#bbf7d0",
        stroke: "#1f2937",
        strokeWidth: 2,
        ...(shape === "rect" ? { radius: 8 } : {}),
      });
    },
    [readOnly, insertElement]
  );

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
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId && !readOnly) {
        e.preventDefault();
        deleteSelected();
      } else if (e.key === "Escape") {
        onSelect(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId, editingId, readOnly, deleteSelected, onSelect]);

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
            onAddText={addText}
            onAddShape={addShape}
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
          style={{ left: offsetX, top: offsetY, width: stageW, height: stageH }}
        >
          <Stage
            ref={stageRef}
            width={stageW}
            height={stageH}
            scaleX={scale}
            scaleY={scale}
            onMouseDown={(e) => {
              if (e.target === e.target.getStage()) onSelect(null);
            }}
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
                  draggable={!readOnly}
                  onMouseDown={() => onSelect(el.id)}
                  onTap={() => onSelect(el.id)}
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
