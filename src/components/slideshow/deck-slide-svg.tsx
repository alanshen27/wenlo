import {
  DECK_HEIGHT,
  DECK_WIDTH,
  DEFAULT_SLIDE_BG,
  type DeckElement,
  type Slide,
} from "@/lib/decks/deck-schema";
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
        <SvgElement key={el.id} el={el} />
      ))}
    </svg>
  );
}

function wrapLines(text: string, max: number): string[] {
  // Rough character-per-line estimate so multi-line text isn't a single clipped
  // row in the thumbnail; this is approximate by design.
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

function SvgElement({ el }: { el: DeckElement }) {
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

  if (el.type === "image") {
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
  }

  // text
  const charsPerLine = Math.max(4, Math.floor(el.w / (el.fontSize * 0.55)));
  const lines = wrapLines(el.text || "", charsPerLine);
  const anchor = el.align === "center" ? "middle" : el.align === "right" ? "end" : "start";
  const tx = el.align === "center" ? el.w / 2 : el.align === "right" ? el.w : 0;
  return (
    <text
      fontSize={el.fontSize}
      fontFamily={el.fontFamily || FONT}
      fontWeight={el.fontWeight ?? 400}
      fontStyle={el.italic ? "italic" : "normal"}
      fill={el.color}
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
