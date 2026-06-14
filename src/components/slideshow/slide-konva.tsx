"use client";

import { Rect, Ellipse, Line, Text as KonvaText } from "react-konva";
import type { DeckElement } from "@/lib/decks/deck-schema";
import { CanvasImageNode } from "@/components/canvas/canvas-image";

/**
 * Renders an element's visual content at local (0,0). Shared by the editor
 * canvas (wrapped in an interactive Group) and present mode (static Group) so
 * what you edit is exactly what you present.
 */
export function ElementContent({ el, hideText }: { el: DeckElement; hideText?: boolean }) {
  if (el.type === "shape" && el.shape === "rect") {
    return (
      <Rect
        width={el.w}
        height={el.h}
        fill={el.fill && el.fill !== "transparent" ? el.fill : undefined}
        stroke={el.stroke && el.stroke !== "transparent" ? el.stroke : undefined}
        strokeWidth={el.strokeWidth}
        cornerRadius={el.radius ?? 0}
      />
    );
  }
  if (el.type === "shape" && el.shape === "ellipse") {
    return (
      <Ellipse
        x={el.w / 2}
        y={el.h / 2}
        radiusX={Math.abs(el.w / 2)}
        radiusY={Math.abs(el.h / 2)}
        fill={el.fill && el.fill !== "transparent" ? el.fill : undefined}
        stroke={el.stroke && el.stroke !== "transparent" ? el.stroke : undefined}
        strokeWidth={el.strokeWidth}
      />
    );
  }
  if (el.type === "shape" && el.shape === "line") {
    return (
      <Line
        points={[0, 0, el.w, el.h]}
        stroke={el.stroke && el.stroke !== "transparent" ? el.stroke : "#000"}
        strokeWidth={el.strokeWidth ?? 2}
        lineCap="round"
      />
    );
  }
  if (el.type === "text") {
    if (hideText) return null;
    return (
      <KonvaText
        text={el.text || " "}
        width={el.w}
        fontSize={el.fontSize}
        fontFamily={el.fontFamily || "Arial"}
        fontStyle={
          `${el.italic ? "italic " : ""}${(el.fontWeight ?? 400) >= 600 ? "bold" : "normal"}`.trim()
        }
        fill={el.color}
        align={el.align ?? "left"}
        wrap="word"
        lineHeight={1.2}
      />
    );
  }
  if (el.type === "image") {
    return <CanvasImageNode src={el.src} width={el.w} height={el.h} />;
  }
  return null;
}
