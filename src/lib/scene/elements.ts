// Canonical scene element types shared by decks (slides), whiteboards, and
// future fixed-surface editors (e.g. PDF annotation). Deck uses the minimal
// subset { text, image, shape }; boards add path, sticky, arrow, connector.

import type { ShapeKind } from "@/lib/canvas/shapes";

export type { ShapeKind };

export type TextAlign = "left" | "center" | "right";

export type TextListStyle = "none" | "bullet";

/** Position + optional box size. Box elements always set w/h. */
export type ElementBase = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  opacity?: number;
};

export type TextElement = ElementBase & {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily?: string;
  fontWeight?: number;
  italic?: boolean;
  underline?: boolean;
  /** Optional hyperlink URL for the whole text block. */
  link?: string;
  /** When `"bullet"`, each line is rendered as a bulleted list item. */
  listStyle?: TextListStyle;
  color: string;
  align?: TextAlign;
};

export type ImageElement = ElementBase & {
  type: "image";
  src: string;
  documentId?: string;
  /** Caption shown below the image. */
  caption?: string;
};

export type ShapeElement = ElementBase & {
  type: "shape";
  shape: ShapeKind;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
};

export type PathElement = Omit<ElementBase, "w" | "h"> & {
  type: "path";
  /** Flat [x0,y0,x1,y1,...] relative to (x,y). */
  points: number[];
  stroke: string;
  strokeWidth: number;
};

export type StickyElement = ElementBase & {
  type: "sticky";
  text: string;
  fill: string;
  color: string;
};

export type ArrowElement = Omit<ElementBase, "w" | "h"> & {
  type: "arrow";
  /** Flat [x0,y0,x1,y1] relative to (x,y). */
  points: number[];
  stroke: string;
  strokeWidth: number;
};

export type ConnectorEndpoint =
  | { kind: "element"; elementId: string }
  | { kind: "point"; x: number; y: number };

export type ConnectorElement = Omit<ElementBase, "w" | "h"> & {
  type: "connector";
  start: ConnectorEndpoint;
  end: ConnectorEndpoint;
  stroke: string;
  strokeWidth: number;
};

export type SceneElement =
  | TextElement
  | ImageElement
  | ShapeElement
  | PathElement
  | StickyElement
  | ArrowElement
  | ConnectorElement;

export type SceneElementType = SceneElement["type"];

/** Deck / slide subset — presentation tools only create these. */
export type CoreElement = TextElement | ImageElement | ShapeElement;

export type CoreElementType = CoreElement["type"];

export const CORE_ELEMENT_TYPES = new Set<CoreElementType>(["text", "image", "shape"]);

export function isCoreElement(el: SceneElement): el is CoreElement {
  return CORE_ELEMENT_TYPES.has(el.type as CoreElementType);
}

/** Slide elements including stroke arrows and connectors (no pen/sticky). */
export type DeckElement = CoreElement | ArrowElement | ConnectorElement;

export type DeckElementType = DeckElement["type"];

const DECK_ELEMENT_TYPES = new Set<DeckElementType>([
  "text",
  "image",
  "shape",
  "arrow",
  "connector",
]);

export function isDeckElement(el: SceneElement): el is DeckElement {
  return DECK_ELEMENT_TYPES.has(el.type as DeckElementType);
}

/** Elements edited via endpoint handles instead of the box transformer. */
export function usesEndpointHandles(el: SceneElement): boolean {
  if (el.type === "arrow") return true;
  if (el.type === "connector") return true;
  return el.type === "shape" && el.shape === "line";
}
