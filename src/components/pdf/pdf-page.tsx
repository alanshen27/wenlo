"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PdfAnnotationSvg } from "@/components/pdf/pdf-annotation-svg";
import type { PdfTool } from "@/components/pdf/pdf-toolbar";
import type { PdfDocumentProxy } from "@/lib/pdfs/pdf-js";
import {
  appendInkPoint,
  newPdfAnnotationId,
  PDF_DEFAULTS,
  type PdfAnnotationElement,
  type PdfPageAnnotations,
  type PdfPagePatch,
} from "@/lib/pdfs/pdf-annotation-schema";
import { hitTestBox, hitTestPolyline } from "@/lib/pdfs/pdf-geometry";
import { cn } from "@/lib/core/utils";

type DraftState =
  | { kind: "ink"; id: string; points: number[] }
  | { kind: "highlight"; id: string; points: number[] }
  | { kind: "note"; id: string; x0: number; y0: number; x1: number; y1: number }
  | { kind: "move"; id: string; startX: number; startY: number; origX: number; origY: number }
  | { kind: "eraser" };

function normRect(x0: number, y0: number, x1: number, y1: number) {
  return {
    x: Math.min(x0, x1),
    y: Math.min(y0, y1),
    w: Math.abs(x1 - x0),
    h: Math.abs(y1 - y0),
  };
}

function hitTestElement(
  el: PdfAnnotationElement,
  nx: number,
  ny: number
): boolean {
  if (el.type === "ink" || el.type === "highlight") {
    return hitTestPolyline(el.points, nx, ny, el.strokeWidth + 0.004);
  }
  if (el.type === "note") {
    return hitTestBox(el.x, el.y, el.w, el.h, nx, ny);
  }
  return false;
}

function collectEraserHits(
  elements: Record<string, PdfAnnotationElement>,
  elementOrder: string[],
  nx: number,
  ny: number,
  radius: number
): string[] {
  const hits: string[] = [];
  for (const id of elementOrder) {
    const el = elements[id];
    if (!el) continue;
    if (el.type === "ink" || el.type === "highlight") {
      if (hitTestPolyline(el.points, nx, ny, Math.max(el.strokeWidth, radius))) {
        hits.push(id);
      }
    } else if (el.type === "note") {
      if (hitTestBox(el.x, el.y, el.w, el.h, nx, ny)) {
        hits.push(id);
      }
    }
  }
  return hits;
}

export function PdfPage({
  pageNumber,
  pdfDoc,
  pageAnnotations,
  tool,
  selectedId,
  editingId,
  readOnly,
  visible,
  inkColor,
  inkWidth,
  highlightColor,
  highlightWidth,
  noteColor,
  eraserRadius,
  onSelect,
  onSetEditing,
  onPatch,
}: {
  pageNumber: number;
  pdfDoc: PdfDocumentProxy;
  pageAnnotations: PdfPageAnnotations;
  tool: PdfTool;
  selectedId: string | null;
  editingId: string | null;
  readOnly: boolean;
  visible: boolean;
  inkColor: string;
  inkWidth: number;
  highlightColor: string;
  highlightWidth: number;
  noteColor: string;
  eraserRadius: number;
  onSelect: (id: string | null) => void;
  onSetEditing: (id: string | null) => void;
  onPatch: (patch: PdfPagePatch) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [draft, setDraft] = useState<DraftState | null>(null);
  const draftRef = useRef<DraftState | null>(null);
  const erasedRef = useRef<Set<string>>(new Set());
  const erasingRef = useRef(false);
  draftRef.current = draft;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry?.contentRect.width ?? 0);
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !pdfDoc || containerWidth <= 0) return;
    let cancelled = false;
    (async () => {
      const page = await pdfDoc.getPage(pageNumber);
      if (cancelled) return;
      const unscaled = page.getViewport({ scale: 1 });
      const scale = containerWidth / unscaled.width;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setDimensions({ width: viewport.width, height: viewport.height });
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await page.render({ canvasContext: ctx, canvas, viewport }).promise;
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [visible, pdfDoc, pageNumber, containerWidth]);

  const pointerNorm = useCallback((e: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return null;
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  }, []);

  const commitElement = useCallback(
    (el: PdfAnnotationElement) => {
      onPatch({ upserts: { [el.id]: el } });
    },
    [onPatch]
  );

  const eraseAt = useCallback(
    (nx: number, ny: number) => {
      const hits = collectEraserHits(
        pageAnnotations.elements,
        pageAnnotations.elementOrder,
        nx,
        ny,
        eraserRadius
      );
      const fresh = hits.filter((id) => !erasedRef.current.has(id));
      if (fresh.length === 0) return;
      for (const id of fresh) erasedRef.current.add(id);
      onPatch({ deletes: fresh });
    },
    [pageAnnotations.elements, pageAnnotations.elementOrder, eraserRadius, onPatch]
  );

  const finishDraft = useCallback(() => {
    const d = draftRef.current;
    setDraft(null);
    if (!d) return;

    if (d.kind === "eraser") {
      erasedRef.current.clear();
      return;
    }

    if (d.kind === "ink" && d.points.length >= 4) {
      commitElement({
        id: d.id,
        type: "ink",
        points: d.points,
        stroke: inkColor,
        strokeWidth: inkWidth,
      });
      return;
    }

    if (d.kind === "highlight" && d.points.length >= 4) {
      commitElement({
        id: d.id,
        type: "highlight",
        points: d.points,
        color: highlightColor,
        strokeWidth: highlightWidth,
      });
      return;
    }

    if (d.kind === "move") {
      return;
    }

    if (d.kind === "note") {
      const rect = normRect(d.x0, d.y0, d.x1, d.y1);
      const w = Math.max(rect.w, PDF_DEFAULTS.noteMinW);
      const h = Math.max(rect.h, PDF_DEFAULTS.noteMinH);
      commitElement({
        id: d.id,
        type: "note",
        x: rect.x,
        y: rect.y,
        w,
        h,
        text: "",
        color: noteColor,
      });
      onSelect(d.id);
      onSetEditing(d.id);
    }
  }, [
    commitElement,
    onSelect,
    onSetEditing,
    onPatch,
    inkColor,
    inkWidth,
    highlightColor,
    highlightWidth,
    noteColor,
  ]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (readOnly) return;
      const pos = pointerNorm(e);
      if (!pos) return;
      e.currentTarget.setPointerCapture(e.pointerId);

      if (tool === "eraser") {
        erasedRef.current.clear();
        erasingRef.current = true;
        eraseAt(pos.x, pos.y);
        setDraft({ kind: "eraser" });
        onSelect(null);
        onSetEditing(null);
        return;
      }

      if (tool === "select") {
        const order = [...pageAnnotations.elementOrder].reverse();
        for (const id of order) {
          const el = pageAnnotations.elements[id];
          if (el && hitTestElement(el, pos.x, pos.y)) {
            onSelect(id);
            if (el.type === "note") {
              setDraft({
                kind: "move",
                id,
                startX: pos.x,
                startY: pos.y,
                origX: el.x,
                origY: el.y,
              });
            }
            return;
          }
        }
        onSelect(null);
        onSetEditing(null);
        return;
      }

      onSelect(null);
      onSetEditing(null);
      const id = newPdfAnnotationId();

      if (tool === "pen") {
        setDraft({ kind: "ink", id, points: [pos.x, pos.y] });
      } else if (tool === "highlight") {
        setDraft({ kind: "highlight", id, points: [pos.x, pos.y] });
      } else if (tool === "note") {
        setDraft({ kind: "note", id, x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y });
      }
    },
    [readOnly, pointerNorm, tool, pageAnnotations, onSelect, onSetEditing, eraseAt]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const pos = pointerNorm(e);
      if (!pos) return;

      if (erasingRef.current || draft?.kind === "eraser") {
        eraseAt(pos.x, pos.y);
        return;
      }

      if (!draft) return;

      if (draft.kind === "ink" || draft.kind === "highlight") {
        setDraft((prev) => {
          if (!prev || (prev.kind !== "ink" && prev.kind !== "highlight")) return prev;
          return { ...prev, points: appendInkPoint(prev.points, pos.x, pos.y) };
        });
        return;
      }

      if (draft.kind === "note") {
        setDraft({ ...draft, x1: pos.x, y1: pos.y });
        return;
      }

      if (draft.kind === "move") {
        const dx = pos.x - draft.startX;
        const dy = pos.y - draft.startY;
        const el = pageAnnotations.elements[draft.id];
        if (el?.type === "note") {
          onPatch({
            upserts: {
              [draft.id]: { ...el, x: draft.origX + dx, y: draft.origY + dy },
            },
          });
        }
      }
    },
    [pointerNorm, draft, pageAnnotations.elements, onPatch, eraseAt]
  );

  const handlePointerUp = useCallback(() => {
    erasingRef.current = false;
    finishDraft();
  }, [finishDraft]);

  const handleNoteTextChange = useCallback(
    (id: string, text: string) => {
      const el = pageAnnotations.elements[id];
      if (el?.type === "note") {
        onPatch({ upserts: { [id]: { ...el, text } } });
      }
    },
    [pageAnnotations.elements, onPatch]
  );

  const draftElements = { ...pageAnnotations.elements };
  const draftOrder = [...pageAnnotations.elementOrder];

  if (draft?.kind === "ink" && draft.points.length >= 2) {
    draftElements[draft.id] = {
      id: draft.id,
      type: "ink",
      points: draft.points,
      stroke: inkColor,
      strokeWidth: inkWidth,
    };
    if (!draftOrder.includes(draft.id)) draftOrder.push(draft.id);
  } else if (draft?.kind === "highlight" && draft.points.length >= 2) {
    draftElements[draft.id] = {
      id: draft.id,
      type: "highlight",
      points: draft.points,
      color: highlightColor,
      strokeWidth: highlightWidth,
    };
    if (!draftOrder.includes(draft.id)) draftOrder.push(draft.id);
  } else if (draft?.kind === "note") {
    const rect = normRect(draft.x0, draft.y0, draft.x1, draft.y1);
    draftElements[draft.id] = {
      id: draft.id,
      type: "note",
      x: rect.x,
      y: rect.y,
      w: Math.max(rect.w, PDF_DEFAULTS.noteMinW),
      h: Math.max(rect.h, PDF_DEFAULTS.noteMinH),
      text: "",
      color: noteColor,
    };
    if (!draftOrder.includes(draft.id)) draftOrder.push(draft.id);
  }

  const cursorClass =
    tool === "eraser"
      ? "cursor-cell"
      : tool === "select"
        ? "cursor-default"
        : "cursor-crosshair";

  return (
    <div
      ref={containerRef}
      className="relative mx-auto w-full max-w-4xl bg-white shadow-sm"
      data-page={pageNumber}
    >
      {!visible ? (
        <div className="flex aspect-[8.5/11] items-center justify-center bg-muted/20 text-xs text-muted-foreground">
          Page {pageNumber}
        </div>
      ) : (
        <>
          <canvas ref={canvasRef} className="block w-full" />
          <div
            className={cn("absolute inset-0", readOnly ? "pointer-events-none" : cursorClass)}
            onPointerDown={readOnly ? undefined : handlePointerDown}
            onPointerMove={readOnly ? undefined : handlePointerMove}
            onPointerUp={readOnly ? undefined : handlePointerUp}
            onPointerCancel={readOnly ? undefined : handlePointerUp}
          >
            <PdfAnnotationSvg
              elements={draftElements}
              elementOrder={draftOrder}
              width={dimensions.width}
              height={dimensions.height}
              selectedId={selectedId}
              editingId={editingId}
              readOnly={readOnly}
              onSelect={onSelect}
              onEditStart={onSetEditing}
              onNoteTextChange={handleNoteTextChange}
              onEditEnd={() => onSetEditing(null)}
            />
          </div>
        </>
      )}
    </div>
  );
}
