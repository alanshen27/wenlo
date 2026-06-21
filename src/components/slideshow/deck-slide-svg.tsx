import {
  DECK_HEIGHT,
  DECK_WIDTH,
  DEFAULT_SLIDE_BG,
  type DeckElement,
  type Slide,
} from "@/lib/decks/deck-schema";
import { shapePolygonSvgPoints } from "@/lib/canvas/shapes";
import { BULLET_CHAR, splitTextLines } from "@/lib/scene/text-list";
import { resolveConnector } from "@/lib/scene/scene-geometry";
import { cn } from "@/lib/core/utils";

const FONT = "Arial, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

/**
 * Lightweight, read-only SVG render of a single slide, used for the thumbnail
 * rail and the cloud preview panel. Dependency-free (no Konva) and approximate
 * (text doesn't wrap) so it's cheap to mount many at once.
 */
export function DeckSlideSvg({
  slide,
  className,
  ariaLabel = "Slide preview",
}: {
  slide: Slide | undefined;
  className?: string;
  ariaLabel?: string;
}) {
  const elements = slide
    ? slide.elementOrder
        .map((id) => slide.elements[id])
        .filter((el): el is DeckElement => Boolean(el))
    : [];

  const elementMap = slide?.elements ?? {};

  return (
    <svg
      viewBox={`0 0 ${DECK_WIDTH} ${DECK_HEIGHT}`}
      className={cn("block", className)}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={ariaLabel}
    >
      <rect
        x={0}
        y={0}
        width={DECK_WIDTH}
        height={DECK_HEIGHT}
        fill={slide?.background ?? DEFAULT_SLIDE_BG}
      />
      {elements.map((el) => (
        <SvgElement key={el.id} el={el} elements={elementMap} />
      ))}
    </svg>
  );
}

function wrapLines(text: string, max: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = (line + " " + word).trim();
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

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

function SvgElement({
  el,
  elements,
}: {
  el: DeckElement;
  elements: Record<string, DeckElement>;
}) {
  const transform = `translate(${el.x} ${el.y}) rotate(${el.rotation ?? 0})`;
  const opacity = el.opacity ?? 1;

  if (el.type === "shape") {
    if (el.shape === "rect") {
      return (
        <rect
          width={el.w}
          height={el.h}
          rx={el.radius ?? 0}
          fill={el.fill && el.fill !== "transparent" ? el.fill : "none"}
          stroke={el.stroke && el.stroke !== "transparent" ? el.stroke : undefined}
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
          fill={el.fill && el.fill !== "transparent" ? el.fill : "none"}
          stroke={el.stroke && el.stroke !== "transparent" ? el.stroke : undefined}
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
          stroke={el.stroke && el.stroke !== "transparent" ? el.stroke : "#000"}
          strokeWidth={el.strokeWidth ?? 2}
          strokeLinecap="round"
          transform={transform}
          opacity={opacity}
        />
      );
    }
    return (
      <polygon
        points={shapePolygonSvgPoints(el.shape, el.w, el.h) ?? ""}
        fill={el.fill && el.fill !== "transparent" ? el.fill : "none"}
        stroke={el.stroke && el.stroke !== "transparent" ? el.stroke : undefined}
        strokeWidth={el.strokeWidth ?? undefined}
        strokeLinejoin="round"
        transform={transform}
        opacity={opacity}
      />
    );
  }

  if (el.type === "image") {
    const caption = el.caption?.trim();
    return (
      <g transform={transform} opacity={opacity}>
        <image href={el.src} width={el.w} height={el.h} preserveAspectRatio="xMidYMid slice" />
        {caption && (
          <text
            x={el.w / 2}
            y={el.h + 20}
            fontSize={14}
            fontFamily={FONT}
            fill="#64748b"
            textAnchor="middle"
          >
            {caption}
          </text>
        )}
      </g>
    );
  }

  if (el.type === "arrow") {
    const x1 = el.x + el.points[0];
    const y1 = el.y + el.points[1];
    const x2 = el.x + el.points[2];
    const y2 = el.y + el.points[3];
    const head = arrowHeadPoints(x1, y1, x2, y2, 10);
    return (
      <g opacity={opacity}>
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={el.stroke}
          strokeWidth={el.strokeWidth}
          strokeLinecap="round"
        />
        <polygon points={head} fill={el.stroke} />
      </g>
    );
  }

  if (el.type === "connector") {
    const pts = resolveConnector(el, elements);
    if (!pts) return null;
    const head = arrowHeadPoints(pts[0], pts[1], pts[2], pts[3], 10);
    return (
      <g opacity={opacity}>
        <line
          x1={pts[0]}
          y1={pts[1]}
          x2={pts[2]}
          y2={pts[3]}
          stroke={el.stroke}
          strokeWidth={el.strokeWidth}
          strokeLinecap="round"
        />
        <polygon points={head} fill={el.stroke} />
      </g>
    );
  }

  if (el.type === "text") {
    const display =
      el.listStyle === "bullet"
        ? splitTextLines(el.text)
            .map((line) => `${BULLET_CHAR} ${line}`)
            .join("\n")
        : el.text || "";
    const charsPerLine = Math.max(4, Math.floor(el.w / (el.fontSize * 0.55)));
    const lines = wrapLines(display, charsPerLine);
    const anchor = el.align === "center" ? "middle" : el.align === "right" ? "end" : "start";
    const tx = el.align === "center" ? el.w / 2 : el.align === "right" ? el.w : 0;
    const hasLink = Boolean(el.link?.trim());
    return (
      <text
        fontSize={el.fontSize}
        fontFamily={el.fontFamily || FONT}
        fontWeight={el.fontWeight ?? 400}
        fontStyle={el.italic ? "italic" : "normal"}
        textDecoration={el.underline || hasLink ? "underline" : undefined}
        fill={hasLink ? "#2563eb" : el.color}
        transform={transform}
        opacity={opacity}
        textAnchor={anchor}
      >
        {lines.map((line, i) => (
          <tspan key={i} x={tx} dy={i === 0 ? el.fontSize : el.fontSize * 1.2}>
            {line || " "}
          </tspan>
        ))}
      </text>
    );
  }

  return null;
}
