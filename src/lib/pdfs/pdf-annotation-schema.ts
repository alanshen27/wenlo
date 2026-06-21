export const PDF_ANNOTATION_VERSION = 1 as const;

export type PdfInkElement = {
  id: string;
  type: "ink";
  /** Flat [x0,y0,x1,y1,…] in 0–1 page space (relative to top-left of page). */
  points: number[];
  stroke: string;
  strokeWidth: number;
};

export type PdfHighlightElement = {
  id: string;
  type: "highlight";
  /** Flat [x0,y0,x1,y1,…] in 0–1 page space. */
  points: number[];
  color: string;
  strokeWidth: number;
};

export type PdfNoteElement = {
  id: string;
  type: "note";
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  color?: string;
};

export type PdfAnnotationElement = PdfInkElement | PdfHighlightElement | PdfNoteElement;

export type PdfPageAnnotations = {
  elementOrder: string[];
  elements: Record<string, PdfAnnotationElement>;
};

export type PdfAnnotationDoc = {
  version: typeof PDF_ANNOTATION_VERSION;
  pages: Record<string, PdfPageAnnotations>;
};

export type PdfPagePatch = {
  upserts?: Record<string, PdfAnnotationElement>;
  deletes?: string[];
  elementOrder?: string[];
};

export type PdfAnnotationPatch = {
  pages?: Record<string, PdfPagePatch>;
};

export function newPdfAnnotationId(prefix = "ann"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function createEmptyPageAnnotations(): PdfPageAnnotations {
  return { elementOrder: [], elements: {} };
}

export function createEmptyPdfAnnotations(): PdfAnnotationDoc {
  return { version: PDF_ANNOTATION_VERSION, pages: {} };
}

function normalizeHighlight(raw: Record<string, unknown>): PdfHighlightElement | null {
  if (raw.type !== "highlight" || typeof raw.id !== "string") return null;
  const color =
    typeof raw.color === "string" ? raw.color : PDF_DEFAULTS.highlightColor;

  if (Array.isArray(raw.points) && raw.points.length >= 4) {
    return {
      id: raw.id,
      type: "highlight",
      points: raw.points as number[],
      color,
      strokeWidth:
        typeof raw.strokeWidth === "number"
          ? raw.strokeWidth
          : PDF_DEFAULTS.highlightStrokeWidth,
    };
  }

  // Legacy box highlights → horizontal stroke through the band.
  if (
    typeof raw.x === "number" &&
    typeof raw.y === "number" &&
    typeof raw.w === "number" &&
    typeof raw.h === "number"
  ) {
    const midY = raw.y + raw.h / 2;
    return {
      id: raw.id,
      type: "highlight",
      points: [raw.x, midY, raw.x + raw.w, midY],
      color,
      strokeWidth: Math.max(raw.h * 0.85, PDF_DEFAULTS.highlightStrokeWidth),
    };
  }

  return null;
}

function normalizeElement(raw: unknown): PdfAnnotationElement | null {
  if (!raw || typeof raw !== "object") return null;
  const el = raw as Record<string, unknown>;
  if (el.type === "highlight") return normalizeHighlight(el);
  if (el.type === "ink" && typeof el.id === "string" && Array.isArray(el.points)) {
    return {
      id: el.id,
      type: "ink",
      points: el.points as number[],
      stroke: typeof el.stroke === "string" ? el.stroke : PDF_DEFAULTS.inkStroke,
      strokeWidth:
        typeof el.strokeWidth === "number" ? el.strokeWidth : PDF_DEFAULTS.inkStrokeWidth,
    };
  }
  if (
    el.type === "note" &&
    typeof el.id === "string" &&
    typeof el.x === "number" &&
    typeof el.y === "number" &&
    typeof el.w === "number" &&
    typeof el.h === "number"
  ) {
    return {
      id: el.id,
      type: "note",
      x: el.x,
      y: el.y,
      w: el.w,
      h: el.h,
      text: typeof el.text === "string" ? el.text : "",
      color: typeof el.color === "string" ? el.color : PDF_DEFAULTS.noteFill,
    };
  }
  return null;
}

function normalizePage(input: unknown): PdfPageAnnotations {
  if (!input || typeof input !== "object") return createEmptyPageAnnotations();
  const raw = input as Partial<PdfPageAnnotations>;
  const elements: Record<string, PdfAnnotationElement> = {};
  if (raw.elements && typeof raw.elements === "object") {
    for (const [id, val] of Object.entries(raw.elements)) {
      const el = normalizeElement(val);
      if (el) elements[id] = el;
    }
  }

  const order = Array.isArray(raw.elementOrder)
    ? raw.elementOrder.filter((id) => id in elements)
    : [];
  for (const id of Object.keys(elements)) {
    if (!order.includes(id)) order.push(id);
  }

  return { elementOrder: order, elements };
}

/** Coerces unknown JSON into a valid, well-ordered PdfAnnotationDoc. */
export function normalizePdfAnnotations(input: unknown): PdfAnnotationDoc {
  if (!input || typeof input !== "object") return createEmptyPdfAnnotations();
  const raw = input as Partial<PdfAnnotationDoc>;
  const pages: Record<string, PdfPageAnnotations> = {};
  if (raw.pages && typeof raw.pages === "object") {
    for (const [pageKey, pageVal] of Object.entries(raw.pages)) {
      pages[pageKey] = normalizePage(pageVal);
    }
  }
  return { version: PDF_ANNOTATION_VERSION, pages };
}

export function applyPagePatch(
  page: PdfPageAnnotations,
  patch: PdfPagePatch
): PdfPageAnnotations {
  const elements: Record<string, PdfAnnotationElement> = { ...page.elements };

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
    order = page.elementOrder.filter((id) => id in elements);
    if (patch.upserts) {
      for (const id of Object.keys(patch.upserts)) {
        if (id in elements && !order.includes(id)) order.push(id);
      }
    }
  }

  return { elementOrder: order, elements };
}

export function applyPdfAnnotationPatch(
  doc: PdfAnnotationDoc,
  patch: PdfAnnotationPatch
): PdfAnnotationDoc {
  if (!patch.pages) return doc;

  const pages: Record<string, PdfPageAnnotations> = { ...doc.pages };
  for (const [pageKey, pagePatch] of Object.entries(patch.pages)) {
    const existing = pages[pageKey] ?? createEmptyPageAnnotations();
    const merged = applyPagePatch(existing, pagePatch);
    if (merged.elementOrder.length === 0) {
      delete pages[pageKey];
    } else {
      pages[pageKey] = merged;
    }
  }

  return { version: PDF_ANNOTATION_VERSION, pages };
}

/** Concatenated searchable text from note elements across all pages. */
export function derivePdfAnnotationText(doc: PdfAnnotationDoc): string {
  const parts: string[] = [];
  const pageKeys = Object.keys(doc.pages).sort((a, b) => Number(a) - Number(b));
  for (const pageKey of pageKeys) {
    const page = doc.pages[pageKey];
    if (!page) continue;
    for (const id of page.elementOrder) {
      const el = page.elements[id];
      if (el?.type === "note") {
        const text = el.text?.trim();
        if (text) parts.push(text);
      }
    }
  }
  return parts.join("\n");
}

/** Minimum travel (normalized) before a new pen point is recorded. */
export const PDF_INK_MIN_POINT_DIST = 0.003;

/** Append a normalized point if far enough from the previous one. */
export function appendInkPoint(points: number[], x: number, y: number): number[] {
  if (points.length >= 2) {
    const lx = points[points.length - 2]!;
    const ly = points[points.length - 1]!;
    const dx = x - lx;
    const dy = y - ly;
    if (dx * dx + dy * dy < PDF_INK_MIN_POINT_DIST * PDF_INK_MIN_POINT_DIST) {
      return points;
    }
  }
  return [...points, x, y];
}

export const PDF_DEFAULTS = {
  inkStroke: "#1f2937",
  inkStrokeWidth: 0.004,
  highlightColor: "#ffeb3b",
  highlightStrokeWidth: 0.022,
  eraserRadius: 0.014,
  noteFill: "#fde68a",
  noteTextColor: "#1f2937",
  noteMinW: 0.15,
  noteMinH: 0.08,
} as const;

/** Normalized pen widths (relative to page width). */
export const PDF_INK_WIDTHS = [0.002, 0.004, 0.008] as const;

/** Normalized highlighter marker widths. */
export const PDF_HIGHLIGHT_WIDTHS = [0.014, 0.022, 0.032] as const;

/** Highlighter colors — bright enough for multiply blend over page content. */
export const PDF_HIGHLIGHT_SWATCHES = [
  "#ffeb3b",
  "#a5f3b4",
  "#f9a8d4",
  "#93c5fd",
  "#fdba74",
] as const;

export const PDF_INK_SWATCHES = [
  "#1f2937",
  "#ef4444",
  "#3b82f6",
  "#8b5cf6",
  "#22c55e",
] as const;

export const PDF_NOTE_SWATCHES = [
  "#fde68a",
  "#fecaca",
  "#bbf7d0",
  "#bfdbfe",
  "#e9d5ff",
] as const;

/** Highlight fill opacity at render time (multiply blend on top of page). */
export const PDF_HIGHLIGHT_OPACITY = 0.55;
