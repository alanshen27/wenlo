import type { BoardElement } from "@/lib/boards/board-schema";

export type Box = { x: number; y: number; w: number; h: number };

/** Local (pre-translation) bounding box of an element, ignoring rotation. */
export function localBounds(el: BoardElement): Box {
  if (el.type === "path" || el.type === "arrow") {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < el.points.length; i += 2) {
      xs.push(el.points[i]);
      ys.push(el.points[i + 1]);
    }
    const minX = Math.min(0, ...xs);
    const minY = Math.min(0, ...ys);
    const maxX = Math.max(0, ...xs);
    const maxY = Math.max(0, ...ys);
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
  if (el.type === "text") {
    return { x: 0, y: 0, w: el.w, h: el.fontSize * 1.4 };
  }
  return { x: 0, y: 0, w: el.w, h: el.h };
}

/** Scales an element's geometry in place (used to bake a transform's scale). */
export function scaleElement(
  el: BoardElement,
  scaleX: number,
  scaleY: number
): BoardElement {
  if (el.type === "path" || el.type === "arrow") {
    const points = el.points.map((p, i) => (i % 2 === 0 ? p * scaleX : p * scaleY));
    return { ...el, points };
  }
  if (el.type === "text") {
    return { ...el, w: Math.max(20, el.w * scaleX), fontSize: Math.max(6, el.fontSize * scaleY) };
  }
  return { ...el, w: Math.max(4, el.w * scaleX), h: Math.max(4, el.h * scaleY) };
}
