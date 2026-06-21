import { describe, expect, it } from "vitest";
import {
  applyPagePatch,
  applyPdfAnnotationPatch,
  appendInkPoint,
  createEmptyPdfAnnotations,
  derivePdfAnnotationText,
  normalizePdfAnnotations,
  PDF_ANNOTATION_VERSION,
  type PdfAnnotationDoc,
  type PdfHighlightElement,
  type PdfNoteElement,
} from "./pdf-annotation-schema";

function highlight(id: string): PdfHighlightElement {
  return {
    id,
    type: "highlight",
    points: [0.1, 0.12, 0.3, 0.12],
    color: "#ffeb3b",
    strokeWidth: 0.022,
  };
}

function note(id: string, text: string): PdfNoteElement {
  return { id, type: "note", x: 0.1, y: 0.2, w: 0.15, h: 0.08, text };
}

describe("normalizePdfAnnotations", () => {
  it("returns an empty doc for non-object input", () => {
    expect(normalizePdfAnnotations(undefined)).toEqual(createEmptyPdfAnnotations());
  });

  it("normalizes page element order", () => {
    const doc = normalizePdfAnnotations({
      version: PDF_ANNOTATION_VERSION,
      pages: {
        "1": {
          elements: { a: highlight("a"), b: highlight("b") },
          elementOrder: ["a"],
        },
      },
    });
    expect(doc.pages["1"]!.elementOrder).toEqual(["a", "b"]);
  });

  it("migrates legacy box highlights to strokes", () => {
    const doc = normalizePdfAnnotations({
      version: PDF_ANNOTATION_VERSION,
      pages: {
        "1": {
          elements: {
            a: { id: "a", type: "highlight", x: 0.1, y: 0.1, w: 0.2, h: 0.05, color: "#ffeb3b" },
          },
          elementOrder: ["a"],
        },
      },
    });
    const el = doc.pages["1"]!.elements.a!;
    expect(el.type).toBe("highlight");
    if (el.type === "highlight") {
      expect(el.points.length).toBeGreaterThanOrEqual(4);
      expect(el.strokeWidth).toBeGreaterThan(0);
    }
  });
});

describe("applyPdfAnnotationPatch", () => {
  it("merges page-level upserts", () => {
    const doc = createEmptyPdfAnnotations();
    const next = applyPdfAnnotationPatch(doc, {
      pages: { "2": { upserts: { a: highlight("a") } } },
    });
    expect(next.pages["2"]!.elementOrder).toEqual(["a"]);
  });

  it("removes empty pages after all elements deleted", () => {
    const doc: PdfAnnotationDoc = {
      version: PDF_ANNOTATION_VERSION,
      pages: { "1": { elementOrder: ["a"], elements: { a: highlight("a") } } },
    };
    const next = applyPdfAnnotationPatch(doc, { pages: { "1": { deletes: ["a"] } } });
    expect(next.pages["1"]).toBeUndefined();
  });
});

describe("applyPagePatch", () => {
  it("forces the upsert key as the element id", () => {
    const next = applyPagePatch(
      { elementOrder: [], elements: {} },
      { upserts: { a: { ...highlight("mismatch") } } }
    );
    expect(next.elements.a!.id).toBe("a");
  });
});

describe("derivePdfAnnotationText", () => {
  it("collects note text in page order", () => {
    const doc: PdfAnnotationDoc = {
      version: PDF_ANNOTATION_VERSION,
      pages: {
        "2": { elementOrder: ["b"], elements: { b: note("b", "Second") } },
        "1": { elementOrder: ["a"], elements: { a: note("a", "First") } },
      },
    };
    expect(derivePdfAnnotationText(doc)).toBe("First\nSecond");
  });
});

describe("appendInkPoint", () => {
  it("skips points that are too close together", () => {
    const pts = appendInkPoint([0, 0], 0.0001, 0.0001);
    expect(pts).toEqual([0, 0]);
  });

  it("appends distant points", () => {
    const pts = appendInkPoint([0, 0], 0.1, 0.1);
    expect(pts).toEqual([0, 0, 0.1, 0.1]);
  });
});
