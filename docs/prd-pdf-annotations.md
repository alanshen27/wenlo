# PRD — PDF Annotations

**Status:** Draft · **Owner:** Alan · **Last updated:** 2026-06-20
**Sibling docs:** `docs/prd-slideshows.md`, `docs/prd-whiteboard.md` (share the unified scene
element model in `src/lib/scene/`)

---

## 1. Summary

Let users **annotate uploaded PDFs** inside Recall: open a library PDF, mark it up with pen strokes,
highlights, and text notes, and have those marks **persist and reload** on the same document. The
underlying PDF file stays immutable in storage; annotations live in a separate JSON layer keyed by
page.

This is **not** a new native document type. Uploaded PDFs remain `Document` rows with `type: PDF`,
`storagePath` pointing at the binary, and `content` holding extracted text for search. Annotation
data is additive (`pdfAnnotations Json?`) so existing uploads, indexing, and download keep working.

## 2. Background & problem

Today PDFs are **read-only viewers**:

- `DocumentView` and `FilePreviewPanel` render PDFs in an `<iframe>` pointing at
  `/api/documents/:id/raw`.
- Text is extracted via `unpdf` into `Document.content` for search and the Recall agent.
- There is no way to highlight a passage, scribble in the margin, or leave a sticky note on a page.

Users who annotate PDFs elsewhere (Preview, Acrobat, GoodNotes) lose that work when the file lives in
Recall, or they maintain a parallel annotated copy. Native annotations keep reading, search, and
markup in one place.

## 3. Goals & non-goals

### Goals
- Open any library PDF (`type: PDF`, `mimeType: application/pdf`) in an **annotation-aware viewer**
  (replace the iframe in `DocumentView` for editable sessions).
- **v1 tools:** select, pen (freehand), rectangular highlight, text note.
- **Per-page persistence:** annotations stored per page, survive reload, scoped to the document.
- **Normalized coordinates** (0–1 relative to page width/height) so marks scale when the viewer
  resizes or zooms.
- **Autosave** with the same save-status UX as decks/boards (debounced PATCH).
- **Read-only mode** for library viewers (same `canEdit` / role checks as other documents).
- Annotations are **not** baked into the PDF binary in v1 (no server-side PDF rewrite); export of
  annotated PDF is a follow-on.
- Reuse the **unified scene stack** where it fits (`lib/scene/elements`, patch-based saves) without
  pulling in the full whiteboard tool surface.

### Non-goals (v1)
- Editing PDF text, form fields, or page structure (rotate, delete, merge pages).
- Real-time collaborative annotation (soft lock or Yjs — defer; single editor is fine initially).
- Importing/exporting standard PDF annotation formats (Acrobat `.fdf`, embedded PDF annotations).
- OCR or re-indexing annotated regions for search (extracted `content` stays the source of truth).
- Mobile/touch-optimized markup (desktop-first; view should work on mobile).
- Annotating non-PDF documents (images could share the overlay pattern later).

## 4. How this fits the unified scene architecture

Decks and whiteboards now share one canvas primitive (`SceneCanvas`) and one element vocabulary
(`src/lib/scene/elements.ts`). PDF annotation is a **third fixed-surface profile**:

| | Deck | Whiteboard | PDF |
|---|---|---|---|
| Surface | Fixed 1280×720 slide | Infinite pan/zoom | **Fixed per PDF page** (native page dimensions) |
| Background | Solid color | Empty scene | **pdf.js-rendered page** |
| Overlay | Konva (scene canvas) | Konva (scene canvas) | **SVG** (lightweight, read + edit) |
| Element types | text, image, shape | + path, sticky, arrow, connector | **path, highlight, note** |
| Binary | — | — | **Immutable** `storagePath` |

**Why SVG overlay instead of Konva for PDF?**

- PDF pages scroll vertically; many pages may mount at once — SVG per page is cheaper than a Konva
  `Stage` per page.
- Annotation tools in v1 are simple paths and rects; no transformer-heavy shape editing.
- The same **geometry** (flat `points[]`, normalized boxes) can live in `lib/scene/` even when the
  renderer differs.

A future `PDF_SCENE_CONFIG` could extend `SceneCanvas` if we want one editor file for everything;
v1 may ship a dedicated `PdfViewer` component that still reads/writes the same `PdfAnnotationDoc`
schema.

## 5. Users & key use cases

- **Reader:** "Highlight this paragraph and jot a note in the margin" on a paper PDF in the library.
- **Student:** "Circle the diagram on page 4" without leaving Recall.
- **Agent / search:** "Find the PDF about Q3 revenue" still works via extracted text; annotations are
  not required for v1 search (optional later: index note text).

## 6. Architecture & data model

### 6.1 Storage

Add to the existing `Document` model (`prisma/schema.prisma`):

```prisma
// Per-page annotation overlay for PDF documents. Null for non-PDFs and unmarked PDFs.
// See src/lib/pdfs/pdf-annotation-schema.ts.
pdfAnnotations Json?
```

- `storagePath` — unchanged; always the original upload.
- `content` — unchanged; extracted text for search.
- `pdfAnnotations` — our overlay only; never overwrites the binary.

### 6.2 Annotation JSON schema

Flat, page-keyed, collaboration-friendly (same patterns as `SceneDoc`):

```ts
type PdfAnnotationDoc = {
  version: 1;
  pages: Record<string, PdfPageAnnotations>; // key = 1-based page number as string ("1", "2", …)
};

type PdfPageAnnotations = {
  elementOrder: string[];
  elements: Record<string, PdfAnnotationElement>;
};

type PdfAnnotationElement =
  | PdfInkElement      // pen — reuses path shape: points relative to page, normalized 0–1
  | PdfHighlightElement // semi-transparent rect
  | PdfNoteElement;    // text box / sticky-style note

type PdfInkElement = {
  id: string;
  type: "ink";
  /** Flat [x0,y0,x1,y1,…] in 0–1 page space (relative to top-left of page). */
  points: number[];
  stroke: string;
  strokeWidth: number; // in normalized units or fixed px at render time
};

type PdfHighlightElement = {
  id: string;
  type: "highlight";
  x: number; y: number; w: number; h: number; // 0–1
  color: string; // e.g. "#fef08a" @ 40% opacity at render
};

type PdfNoteElement = {
  id: string;
  type: "note";
  x: number; y: number; w: number; h: number; // 0–1
  text: string;
  color?: string;
};
```

**Coordinate convention:** all positions are **normalized to the PDF page's media box** (0–1). The
viewer multiplies by rendered page width/height. This keeps annotations stable across zoom and
responsive layout.

**Derived text (optional v1.1):** concatenate `note.text` across pages into a suffix on
`Document.content` or a separate index field so notes are searchable.

### 6.3 Rendering

- **Page content:** [`pdfjs-dist`](https://mozilla.github.io/pdf.js/) (or `react-pdf`) renders each
  page to a `<canvas>` (or canvas + text layer if we need selection later).
- **Annotation layer:** absolutely positioned **SVG** over each page canvas, same dimensions.
- **Interaction:** pointer events on the SVG; pen draws polyline paths; highlight tool drag-creates
  a rect; note tool places a text box (inline `<textarea>` on double-click / after place).
- **Scroll:** vertical list of pages (like most PDF readers), not infinite canvas pan.

Preview surfaces (`FilePreviewPanel`, cloud thumbnails) can render page 1 + annotations with the
same SVG helper read-only (no pdf.js required in the thumb if we only show "has annotations" badge
in v1).

### 6.4 API endpoints

| Route | Method | Purpose |
|---|---|---|
| `/api/documents/[id]` | GET | Include `pdfAnnotations` in the response for PDF docs (or always null). |
| `/api/documents/[id]/annotations` | GET | Return normalized `PdfAnnotationDoc`. |
| `/api/documents/[id]/annotations` | PATCH | Merge a `PdfAnnotationPatch` (same upsert/delete/order shape as `ScenePatch`). Re-index optional. |
| `/api/documents/[id]/raw` | GET | Unchanged — serves original PDF bytes for download. |

Auth: same `requireDocument` + library role checks as other document routes (`EDITOR` to PATCH).

### 6.5 Routing & navigation

- No new route segment: PDFs keep opening at
  `/library/{libraryId}/documents/{documentId}` (`DocumentView`).
- `DocumentView` branches: if PDF + has file → render `<PdfAnnotatedView />` instead of `<iframe>`.
- Cloud preview panel: optional read-only first-page preview with annotation overlay (Phase 1.1).

## 7. UX scope (v1)

- **Toolbar:** select, pen, highlight, note (minimal — closer to deck than whiteboard).
- **Pen:** freehand stroke; stays on pen tool after stroke (like whiteboard).
- **Highlight:** drag rect; yellow default; semi-transparent.
- **Note:** click or drag to place; double-click to edit text inline.
- **Select:** click to select mark; Delete to remove; drag to move (highlights + notes).
- **Save:** debounced PATCH; header save status via `useSaveStatus` + `useDocumentHeader`.
- **Download:** existing download button still fetches **unannotated** original (clear labeling).
  "Export annotated PDF" is v2.

## 8. Phase 2+ (out of v1 scope)

- Export annotated PDF (server-side merge with `pdf-lib` or similar).
- Search/index note text.
- Soft edit-lock or Yjs for shared PDF review.
- Extend `SceneCanvas` with `profile: "pdf"` if we want one editor primitive.
- Image documents (same overlay pattern on a fixed image surface).

## 9. Milestones

**Phase 1 — Annotate in the viewer**
1. Schema: `pdfAnnotations Json?` migration + `pdf-annotation-schema.ts` (normalize, patch, derive text).
2. API: `GET/PATCH /api/documents/[id]/annotations`.
3. Viewer: `PdfAnnotatedView` — pdf.js page list + SVG overlay + toolbar.
4. Wire `DocumentView` (replace iframe for PDFs when editing is allowed).
5. Autosave + save status in library header.

**Phase 1.1 — Polish**
6. Read-only annotation render in `FilePreviewPanel` / cloud thumb (page 1).
7. Index note text for search.

**Phase 2 — Export & collab**
8. Download PDF with annotations burned in.
9. Optional real-time or lock-based multi-user review.

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| pdf.js bundle size | Dynamic import in `PdfAnnotatedView`; iframe fallback for read-only if load fails. |
| Many pages = many canvases | Virtualize the page list (render visible pages ± buffer only). |
| Normalized coords vs crop boxes | Use pdf.js viewport dimensions consistently; store page rotation if needed later. |
| Users expect annotated download | Label download as "Original PDF"; export annotated as explicit v2 action. |
| Duplicating pen logic from scene canvas | Share `points[]` capture math in `lib/scene/`; only the renderer differs (SVG vs Konva). |

## 11. Success metrics

- A user can open a library PDF, add pen/highlight/note marks, reload, and see the same annotations.
- Original PDF download is unchanged.
- No regression to PDF text extraction or search on `Document.content`.

## 12. Open questions

- Virtualization library for long PDFs — `react-window` vs hand-rolled intersection observer?
- Default highlight colors / pen widths — match whiteboard defaults or PDF-reader conventions?
- Should viewers see annotations read-only without `EDITOR` role? (Leaning yes.)
- Bake annotations into a flattened PNG per page for thumbnails, or SVG-only preview?

---

### Appendix — relevant existing code

- `src/components/views/document-view.tsx` — current iframe PDF viewer.
- `src/components/cloud/file-preview-panel.tsx` — PDF preview in cloud panel.
- `src/lib/documents/extract.ts` — PDF text extraction (`unpdf`).
- `src/lib/scene/elements.ts` — unified element types (`PathElement` informs ink strokes).
- `src/lib/scene/scene-schema.ts` — patch merge pattern to mirror for annotations.
- `src/components/canvas/scene-canvas.tsx` — fixed-surface editor precedent (deck profile).
- `prisma/schema.prisma` — `Document` model (`PDF` type, `storagePath`, `content`).
