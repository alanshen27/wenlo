import type { BoardDoc, BoardElement } from "@/lib/boards/board-schema";
import { localBounds } from "./board-geometry";
import { cn } from "@/lib/core/utils";

const FONT = "Arial, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

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
 * Intentionally dependency-free (no Konva) and approximate — text doesn't wrap —
 * so it stays cheap to mount in a sidebar thumbnail.
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
  for (const el of elements) {
    const b = globalBounds(el);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
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
      {elements.map((el) => (
        <PreviewElement key={el.id} el={el} />
      ))}
    </svg>
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
    case "arrow":
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
    case "sticky":
      return (
        <g transform={transform} opacity={opacity}>
          <rect width={el.w} height={el.h} rx={4} fill={el.fill} />
          <text x={12} y={26} fontSize={16} fill={el.color} fontFamily={FONT}>
            {el.text.slice(0, 40)}
          </text>
        </g>
      );
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
