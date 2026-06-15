"use client";

import { Text as KonvaText } from "react-konva";
import type { DeckElement } from "@/lib/decks/deck-schema";
import { CanvasImageNode } from "@/components/canvas/canvas-image";
import { ShapeNode } from "@/components/canvas/shape-node";

/**
 * Renders an element's visual content at local (0,0). Shared by the editor
 * canvas (wrapped in an interactive Group) and present mode (static Group) so
 * what you edit is exactly what you present.
 */
export function ElementContent({ el, hideText }: { el: DeckElement; hideText?: boolean }) {
  if (el.type === "shape") {
    return (
      <ShapeNode
        shape={el.shape}
        w={el.w}
        h={el.h}
        fill={el.fill}
        stroke={el.stroke}
        strokeWidth={el.strokeWidth}
        cornerRadius={el.shape === "rect" ? el.radius ?? 0 : undefined}
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
