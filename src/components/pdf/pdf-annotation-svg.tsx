"use client";

import type {
  PdfAnnotationElement,
  PdfHighlightElement,
  PdfInkElement,
  PdfNoteElement,
} from "@/lib/pdfs/pdf-annotation-schema";
import { PDF_DEFAULTS, PDF_HIGHLIGHT_OPACITY } from "@/lib/pdfs/pdf-annotation-schema";
import { cn } from "@/lib/core/utils";

function polylinePath(points: number[], w: number, h: number): string {
  if (points.length < 2) return "";
  let d = `M ${points[0]! * w} ${points[1]! * h}`;
  for (let i = 2; i < points.length; i += 2) {
    d += ` L ${points[i]! * w} ${points[i + 1]! * h}`;
  }
  return d;
}

function HighlightPath({
  el,
  w,
  h,
  selected,
}: {
  el: PdfHighlightElement;
  w: number;
  h: number;
  selected?: boolean;
}) {
  const d = polylinePath(el.points, w, h);
  if (!d) return null;
  const strokeW = Math.max(4, el.strokeWidth * w);

  return (
    <g style={{ mixBlendMode: "multiply" }}>
      <path
        d={d}
        fill="none"
        stroke={el.color}
        strokeWidth={strokeW}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={PDF_HIGHLIGHT_OPACITY}
      />
      {selected && (
        <path
          d={d}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={strokeW + 3}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity={0.35}
          style={{ mixBlendMode: "normal" }}
        />
      )}
    </g>
  );
}

function NoteShape({
  el,
  w,
  h,
  selected,
  editing,
  readOnly,
  onTextChange,
  onEditEnd,
}: {
  el: PdfNoteElement;
  w: number;
  h: number;
  selected?: boolean;
  editing?: boolean;
  readOnly?: boolean;
  onTextChange?: (text: string) => void;
  onEditEnd?: () => void;
}) {
  const fill = el.color ?? PDF_DEFAULTS.noteFill;
  const boxW = el.w * w;
  const boxH = el.h * h;

  if (editing && !readOnly) {
    return (
      <foreignObject x={el.x * w} y={el.y * h} width={boxW} height={boxH}>
        <textarea
          autoFocus
          value={el.text}
          onChange={(e) => onTextChange?.(e.target.value)}
          onBlur={onEditEnd}
          onKeyDown={(e) => {
            if (e.key === "Escape") onEditEnd?.();
          }}
          className="size-full resize-none rounded border border-primary/40 p-1.5 text-xs leading-snug text-foreground outline-none"
          style={{ fontFamily: "inherit", backgroundColor: fill }}
        />
      </foreignObject>
    );
  }

  return (
    <g>
      <rect
        x={el.x * w}
        y={el.y * h}
        width={boxW}
        height={boxH}
        fill={fill}
        stroke={selected ? "hsl(var(--primary))" : "rgba(0,0,0,0.12)"}
        strokeWidth={selected ? 2 : 1}
        rx={4}
      />
      {el.text && (
        <foreignObject x={el.x * w} y={el.y * h} width={boxW} height={boxH}>
          <p
            className="pointer-events-none overflow-hidden p-1.5 text-xs leading-snug text-foreground/90"
            style={{ wordBreak: "break-word" }}
          >
            {el.text}
          </p>
        </foreignObject>
      )}
    </g>
  );
}

export function PdfAnnotationSvg({
  elements,
  elementOrder,
  width,
  height,
  selectedId,
  editingId,
  readOnly,
  onSelect,
  onEditStart,
  onNoteTextChange,
  onEditEnd,
}: {
  elements: Record<string, PdfAnnotationElement>;
  elementOrder: string[];
  width: number;
  height: number;
  selectedId?: string | null;
  editingId?: string | null;
  readOnly?: boolean;
  onSelect?: (id: string | null) => void;
  onEditStart?: (id: string) => void;
  onNoteTextChange?: (id: string, text: string) => void;
  onEditEnd?: () => void;
}) {
  if (width <= 0 || height <= 0) return null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("absolute inset-0 touch-none", readOnly ? "pointer-events-none" : "")}
      style={{ width, height }}
    >
      {elementOrder.map((id) => {
        const el = elements[id];
        if (!el) return null;
        const selected = selectedId === id;
        const editing = editingId === id;

        if (el.type === "ink") {
          const d = polylinePath(el.points, width, height);
          if (!d) return null;
          return (
            <path
              key={id}
              d={d}
              fill="none"
              stroke={el.stroke}
              strokeWidth={Math.max(1, el.strokeWidth * width)}
              strokeLinecap="round"
              strokeLinejoin="round"
              onPointerDown={
                readOnly
                  ? undefined
                  : (e) => {
                      e.stopPropagation();
                      onSelect?.(id);
                    }
              }
              className={selected ? "drop-shadow-[0_0_2px_hsl(var(--primary))]" : undefined}
            />
          );
        }

        if (el.type === "highlight") {
          return (
            <g
              key={id}
              onPointerDown={
                readOnly
                  ? undefined
                  : (e) => {
                      e.stopPropagation();
                      onSelect?.(id);
                    }
              }
            >
              <HighlightPath el={el} w={width} h={height} selected={selected} />
            </g>
          );
        }

        if (el.type === "note") {
          return (
            <g
              key={id}
              onPointerDown={
                readOnly || editing
                  ? undefined
                  : (e) => {
                      e.stopPropagation();
                      onSelect?.(id);
                    }
              }
              onDoubleClick={
                readOnly
                  ? undefined
                  : (e) => {
                      e.stopPropagation();
                      onSelect?.(id);
                      onEditStart?.(id);
                    }
              }
            >
              <NoteShape
                el={el}
                w={width}
                h={height}
                selected={selected}
                editing={editing}
                readOnly={readOnly}
                onTextChange={(text) => onNoteTextChange?.(id, text)}
                onEditEnd={onEditEnd}
              />
            </g>
          );
        }

        return null;
      })}
    </svg>
  );
}
