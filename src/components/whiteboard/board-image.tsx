"use client";

import type { ImageElement } from "@/lib/boards/board-schema";
import { CanvasImageNode } from "@/components/canvas/canvas-image";

/** Thin board-element wrapper over the shared Konva image node. */
export function BoardImageNode({ element }: { element: ImageElement }) {
  return <CanvasImageNode src={element.src} width={element.w} height={element.h} />;
}
