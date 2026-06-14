import type { DeckElement } from "@/lib/decks/deck-schema";

/** Bakes a Konva transform's scale into an element's geometry so coordinates
 *  stay in deck space (the node's scale is reset to 1 afterwards). */
export function scaleElement(
  el: DeckElement,
  scaleX: number,
  scaleY: number
): DeckElement {
  if (el.type === "text") {
    // Width follows the horizontal handle; font size follows the vertical one.
    const fontSize = Math.max(4, Math.round(el.fontSize * scaleY));
    return {
      ...el,
      w: Math.max(20, el.w * scaleX),
      h: Math.max(fontSize, el.h * scaleY),
      fontSize,
    };
  }
  if (el.type === "shape" && el.shape === "line") {
    return { ...el, w: el.w * scaleX, h: el.h * scaleY };
  }
  return { ...el, w: Math.max(4, el.w * scaleX), h: Math.max(4, el.h * scaleY) };
}
