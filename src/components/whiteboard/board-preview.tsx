import type { BoardDoc, BoardElement, ConnectorElement } from "@/lib/boards/board-schema";
import { localBounds, resolveConnector } from "./board-geometry";
import { shapePolygonSvgPoints } from "@/lib/canvas/shapes";
import { cn } from "@/lib/core/utils";

const FONT = "Arial, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const STICKY_PAD = 12;
const STICKY_FONT = 16;
const STICKY_LINE_HEIGHT = STICKY_FONT * 1.3;

/** Rough width estimate — good enough for thumbnail line breaks. */
function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.55;
}

function wrapStickyText(
  text: string,
  maxWidth: number,
  fontSize: number,
  maxLines: number
): string[] {
  if (!text || maxLines <= 0) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  const pushCurrent = () => {
    if (!current) return;
    lines.push(current);
    current = "";
  };

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (estimateTextWidth(candidate, fontSize) <= maxWidth) {
      current = candidate;
      continue;
    }
    pushCurrent();
    if (lines.length >= maxLines) return lines;

    if (estimateTextWidth(word, fontSize) <= maxWidth) {
      current = word;
      continue;
    }

    let chunk = "";
    for (const ch of word) {
      const next = chunk + ch;
      if (estimateTextWidth(next, fontSize) > maxWidth && chunk) {
        lines.push(chunk);
        chunk = ch;
        if (lines.length >= maxLines) return lines;
      } else {
        chunk = next;
      }
    }
    current = chunk;
  }

  pushCurrent();
  return lines.slice(0, maxLines);
}

/** Triangle points for an arrowhead at (x2,y2) pointing away from (x1,y1). */
function arrowHeadPoints(x1: number, y1: number, x2: number, y2: number, size: number): string {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const a1 = angle + Math.PI - 0.45;
  const a2 = angle + Math.PI + 0.45;
  return [
    `${x2},${y2}`,
    `${x2 + Math.cos(a1) * size},${y2 + Math.sin(a1) * size}`,
    `${x2 + Math.cos(a2) * size},${y2 + Math.sin(a2) * size}`,
  ].join(" ");
}

function globalBounds(el: BoardElement) {
  const b = localBounds(el);
  return { x: el.x + b.x, y: el.y + b.y, w: b.w, h: b.h };
}

function pointsStr(points: number[]): string {
  const out: string[] = [];
  for (let i = 0; i < points.length; i += 2) out.push(`${points[i]},${points[i + 1]}`);
  return out.join(" ");
}

/**
 * Lightweight, read-only SVG render of a whiteboard scene for the preview panel.
 * Intentionally dependency-free (no Konva). Text/sticky copy is word-wrapped to
 * the element bounds so thumbnails don't spill outside stickies.
 */
export function BoardPreview({
  scene,
  className,
}: {
  scene: BoardDoc;
  className?: string;
}) {
  const elements = scene.elementOrder
    .map((id) => scene.elements[id])
    .filter((el): el is BoardElement => Boolean(el));

  if (elements.length === 0) {
    return (
      <div className={cn("flex items-center justify-center text-xs text-muted-foreground", className)}>
        Empty board
      </div>
    );
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const extend = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const el of elements) {
    if (el.type === "connector") {
      const pts = resolveConnector(el, scene.elements);
      if (pts) {
        extend(pts[0], pts[1]);
        extend(pts[2], pts[3]);
      }
      continue;
    }
    const b = globalBounds(el);
    extend(b.x, b.y);
    extend(b.x + b.w, b.y + b.h);
  }
  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 1;
    maxY = 1;
  }

  const pad = 32;
  minX -= pad;
  minY -= pad;
  maxX += pad;
  maxY += pad;
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);

  return (
    <svg
      viewBox={`${minX} ${minY} ${width} ${height}`}
      className={className}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Whiteboard preview"
    >
      {elements.map((el) =>
        el.type === "connector" ? (
          <PreviewConnector key={el.id} el={el} scene={scene} />
        ) : (
          <PreviewElement key={el.id} el={el} />
        )
      )}
    </svg>
  );
}

function PreviewConnector({ el, scene }: { el: ConnectorElement; scene: BoardDoc }) {
  const pts = resolveConnector(el, scene.elements);
  if (!pts) return null;
  const [x1, y1, x2, y2] = pts;
  const size = Math.max(8, el.strokeWidth * 2.5);
  return (
    <g opacity={el.opacity ?? 1}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={el.stroke} strokeWidth={el.strokeWidth} strokeLinecap="round" />
      <polygon points={arrowHeadPoints(x1, y1, x2, y2, size)} fill={el.stroke} />
    </g>
  );
}

function PreviewElement({ el }: { el: BoardElement }) {
  const transform = `translate(${el.x} ${el.y}) rotate(${el.rotation ?? 0})`;
  const opacity = el.opacity ?? 1;

  switch (el.type) {
    case "path":
      return (
        <polyline
          points={pointsStr(el.points)}
          fill="none"
          stroke={el.stroke}
          strokeWidth={el.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          transform={transform}
          opacity={opacity}
        />
      );
    case "arrow": {
      const n = el.points.length;
      const head =
        n >= 4
          ? arrowHeadPoints(
              el.points[n - 4],
              el.points[n - 3],
              el.points[n - 2],
              el.points[n - 1],
              Math.max(8, el.strokeWidth * 2.5)
            )
          : null;
      return (
        <g transform={transform} opacity={opacity}>
          <polyline
            points={pointsStr(el.points)}
            fill="none"
            stroke={el.stroke}
            strokeWidth={el.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {head && <polygon points={head} fill={el.stroke} />}
        </g>
      );
    }
    case "shape":
      if (el.shape === "rect") {
        return (
          <rect
            width={el.w}
            height={el.h}
            rx={6}
            fill={el.fill ?? "transparent"}
            stroke={el.stroke ?? undefined}
            strokeWidth={el.strokeWidth ?? undefined}
            transform={transform}
            opacity={opacity}
          />
        );
      }
      if (el.shape === "ellipse") {
        return (
          <ellipse
            cx={el.w / 2}
            cy={el.h / 2}
            rx={Math.abs(el.w / 2)}
            ry={Math.abs(el.h / 2)}
            fill={el.fill ?? "transparent"}
            stroke={el.stroke ?? undefined}
            strokeWidth={el.strokeWidth ?? undefined}
            transform={transform}
            opacity={opacity}
          />
        );
      }
      if (el.shape === "line") {
        return (
          <line
            x1={0}
            y1={0}
            x2={el.w}
            y2={el.h}
            stroke={el.stroke ?? undefined}
            strokeWidth={el.strokeWidth ?? undefined}
            strokeLinecap="round"
            transform={transform}
            opacity={opacity}
          />
        );
      }
      return (
        <polygon
          points={shapePolygonSvgPoints(el.shape, el.w, el.h) ?? ""}
          fill={el.fill ?? "transparent"}
          stroke={el.stroke ?? undefined}
          strokeWidth={el.strokeWidth ?? undefined}
          strokeLinejoin="round"
          transform={transform}
          opacity={opacity}
        />
      );
    case "sticky": {
      const innerW = Math.max(1, el.w - STICKY_PAD * 2);
      const innerH = Math.max(1, el.h - STICKY_PAD * 2);
      const maxLines = Math.max(1, Math.floor(innerH / STICKY_LINE_HEIGHT));
      const lines = wrapStickyText(el.text, innerW, STICKY_FONT, maxLines);
      const clipId = `sticky-clip-${el.id}`;
      return (
        <g transform={transform} opacity={opacity}>
          <defs>
            <clipPath id={clipId}>
              <rect width={el.w} height={el.h} rx={4} />
            </clipPath>
          </defs>
          <rect width={el.w} height={el.h} rx={4} fill={el.fill} />
          <text
            fontSize={STICKY_FONT}
            fill={el.color}
            fontFamily={FONT}
            clipPath={`url(#${clipId})`}
          >
            {lines.map((line, i) => (
              <tspan key={i} x={STICKY_PAD} dy={i === 0 ? STICKY_PAD + STICKY_FONT : STICKY_LINE_HEIGHT}>
                {line}
              </tspan>
            ))}
          </text>
        </g>
      );
    }
    case "text":
      return (
        <text
          fontSize={el.fontSize}
          fill={el.color}
          fontFamily={FONT}
          dominantBaseline="hanging"
          transform={transform}
          opacity={opacity}
        >
          {el.text.slice(0, 80)}
        </text>
      );
    case "image":
      return (
        <image
          href={el.src}
          width={el.w}
          height={el.h}
          transform={transform}
          opacity={opacity}
          preserveAspectRatio="xMidYMid slice"
        />
      );
    default:
      return null;
  }
}
