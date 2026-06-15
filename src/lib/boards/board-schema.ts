// Whiteboard scene model. A board is a single infinite layer of elements stored
// as a flat, id-keyed map with a separate z-order array — the same
// collaboration-friendly shape the deck uses, so element-level patches from
// different editors never collide (different keys → no merge needed).

export const BOARD_VERSION = 2 as const;

export type Viewport = { x: number; y: number; zoom: number };

export type ElementBase = {
  id: string;
  x: number;
  y: number;
  rotation?: number;
  opacity?: number;
};

export type PathElement = ElementBase & {
  type: "path";
  // Flat [x0,y0,x1,y1,...] relative to (x,y).
  points: number[];
  stroke: string;
  strokeWidth: number;
};

export type ShapeElement = ElementBase & {
  type: "shape";
  shape: "rect" | "ellipse" | "line";
  w: number;
  h: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
};

export type TextElement = ElementBase & {
  type: "text";
  text: string;
  w: number;
  fontSize: number;
  color: string;
};

export type StickyElement = ElementBase & {
  type: "sticky";
  text: string;
  w: number;
  h: number;
  fill: string;
  color: string;
};

export type ArrowElement = ElementBase & {
  type: "arrow";
  // Flat [x0,y0,x1,y1] relative to (x,y).
  points: number[];
  stroke: string;
  strokeWidth: number;
};

export type ImageElement = ElementBase & {
  type: "image";
  src: string;
  w: number;
  h: number;
  documentId?: string;
};

/**
 * A connector endpoint is either bound to an element (so it re-routes when that
 * element moves/resizes) or pinned to a free point in scene space.
 */
export type ConnectorEndpoint =
  | { kind: "element"; elementId: string }
  | { kind: "point"; x: number; y: number };

/**
 * An arrow that links two endpoints. Unlike `ArrowElement` (a free-drawn
 * segment), a connector's geometry is derived from its endpoints at render time,
 * so element-bound ends follow their shapes. `x`/`y` are unused (kept at 0 for
 * the shared element base).
 */
export type ConnectorElement = ElementBase & {
  type: "connector";
  start: ConnectorEndpoint;
  end: ConnectorEndpoint;
  stroke: string;
  strokeWidth: number;
};

export type BoardElement =
  | PathElement
  | ShapeElement
  | TextElement
  | StickyElement
  | ArrowElement
  | ImageElement
  | ConnectorElement;

export type BoardElementType = BoardElement["type"];

export type BoardDoc = {
  version: typeof BOARD_VERSION;
  elementOrder: string[];
  elements: Record<string, BoardElement>;
};

/** A minimal, collaboration-friendly diff applied atomically on the server. */
export type BoardPatch = {
  // Full element objects to insert or replace, keyed by id.
  upserts?: Record<string, BoardElement>;
  // Element ids to remove.
  deletes?: string[];
  // New z-order. When omitted, existing order is preserved (new upserts are
  // appended; deletes are pruned).
  elementOrder?: string[];
};

export function createEmptyBoard(): BoardDoc {
  return { version: BOARD_VERSION, elementOrder: [], elements: {} };
}

/** Coerces unknown JSON (or null) into a valid, well-ordered BoardDoc. */
export function normalizeBoard(input: unknown): BoardDoc {
  if (!input || typeof input !== "object") return createEmptyBoard();
  const raw = input as Partial<BoardDoc>;
  const elements: Record<string, BoardElement> =
    raw.elements && typeof raw.elements === "object"
      ? (raw.elements as Record<string, BoardElement>)
      : {};

  const order = Array.isArray(raw.elementOrder) ? raw.elementOrder.filter((id) => id in elements) : [];
  // Append any elements missing from the order so nothing is silently dropped.
  for (const id of Object.keys(elements)) {
    if (!order.includes(id)) order.push(id);
  }

  return { version: BOARD_VERSION, elementOrder: order, elements };
}

/** Pure merge of a patch into a scene; returns a new BoardDoc. */
export function applyBoardPatch(scene: BoardDoc, patch: BoardPatch): BoardDoc {
  const elements: Record<string, BoardElement> = { ...scene.elements };

  if (patch.upserts) {
    for (const [id, el] of Object.entries(patch.upserts)) {
      elements[id] = { ...el, id };
    }
  }

  if (patch.deletes) {
    for (const id of patch.deletes) delete elements[id];
  }

  let order: string[];
  if (patch.elementOrder) {
    order = patch.elementOrder.filter((id) => id in elements);
    for (const id of Object.keys(elements)) {
      if (!order.includes(id)) order.push(id);
    }
  } else {
    order = scene.elementOrder.filter((id) => id in elements);
    if (patch.upserts) {
      for (const id of Object.keys(patch.upserts)) {
        if (id in elements && !order.includes(id)) order.push(id);
      }
    }
  }

  return { version: BOARD_VERSION, elementOrder: order, elements };
}

/** Concatenated text from text + sticky elements, for search indexing. */
export function deriveBoardText(scene: BoardDoc): string {
  const parts: string[] = [];
  for (const id of scene.elementOrder) {
    const el = scene.elements[id];
    if (!el) continue;
    if (el.type === "text" || el.type === "sticky") {
      const text = el.text?.trim();
      if (text) parts.push(text);
    }
  }
  return parts.join("\n");
}
