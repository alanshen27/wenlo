# PRD — Slideshows (Deck Editor)

**Status:** Draft · **Owner:** Alan · **Last updated:** 2026-06-14
**Tracking:** Phase 1 (MVP editor) → Phase 2 (real-time collaboration)

---

## 1. Summary

Add a native **slideshow / presentation deck** editor to Recall: a full WYSIWYG, drag-on-canvas
editor (think a lightweight Google Slides / Canva) that lives alongside Pages and Documents inside a
library. Users can create a deck, add and arrange slides, drop in text / images / shapes, present
fullscreen, and export to `.pptx`.

Decks are **first-class, editable content** (like Pages), not uploaded files (like the existing
`SLIDES` documents, which are read-only extracted text). The schema is designed from day one to be
**Yjs-ready** so real-time collaboration drops in cleanly in Phase 2.

## 2. Background & problem

Recall already stores files and rich Pages and makes them agent-queryable. Today the only "slides"
support is **passive**: a `.pptx` upload is typed `SLIDES` on the `Document` model, has its text
extracted into `Document.content`, and renders as plain paragraphs in `DocumentView` — there is no
way to *create* or *edit* a deck.

Users who live in Recall have to leave for Google Slides / PowerPoint to build a presentation, then
re-upload it (losing editability and collab). A native deck editor keeps creation, storage, search,
and (later) collaboration in one place, and makes decks indexable for the Recall agent like
everything else.

## 3. Goals & non-goals

### Goals
- Create / open / rename / delete a deck within a library or folder, surfaced in the sidebar tree
  and cloud grid like Pages.
- WYSIWYG canvas editing: add and directly manipulate **text, images, and basic shapes**
  (rectangle, ellipse, line) with drag, resize, rotate.
- Slide management: add, delete, duplicate, **reorder** slides via a thumbnail rail.
- **Present mode**: fullscreen, keyboard-navigable (←/→/Esc).
- **Export to `.pptx`** (and PNG/PDF as cheap follow-ons) via `pptxgenjs`.
- Decks are searchable/indexable: derived plain text feeds the existing search/indexing pipeline.
- Schema is **collaboration-friendly** (flat maps, stable ids) so Phase 2 Yjs is additive.

### Non-goals (for v1)
- Real-time multiplayer editing (that is **Phase 2**, explicitly out of Phase 1 scope).
- Animations / transitions / slide timings / speaker notes presenter view (later).
- Importing an existing `.pptx` *into* the editable deck format (one-way export only in v1).
- Templates / theme galleries, charts/tables, embedded video, master slides.
- Mobile / touch editing (view + present should work; editing is desktop-first).

## 4. Decisions already made

- **Canvas engine:** [`react-konva`](https://konvajs.org/) (Konva). MIT-licensed, we own the data
  model. Gives us `Stage`/`Layer`, `Text`/`Image`/`Rect`/`Ellipse`/`Line`, and a built-in
  `Transformer` (resize/rotate/drag handles) out of the box.
- **Export:** [`pptxgenjs`](https://gitbrent.github.io/PptxGenJS/) for `.pptx` generation.
- **Scope:** "A + C" — the MVP editor **and** Yjs collaboration — delivered in **two phases**
  (A first, C layered on the same schema). Phasing was chosen to avoid debugging canvas UX and a
  bespoke CRDT binding simultaneously.
- **Storage:** deck JSON lives in a document-style record's content (see Data Model below), reusing
  existing per-library/folder plumbing rather than inventing new infrastructure.

## 5. Users & key use cases

- **Builder:** "Create a deck in this folder, add 6 slides with a title, bullets, and a logo image,
  rearrange them, and present it in the meeting."
- **Exporter:** "Download this deck as `.pptx` to share with someone outside Recall."
- **Reader / agent:** "Find the slide where we mentioned Q3 revenue" — deck text is indexed so search
  and the Recall agent can surface it.

## 6. Architecture & data model

### 6.1 Where decks live

Two options were considered; **Option A is recommended.**

**Option A (recommended) — new `DECK` type on the `Document` model.**
- Add `DECK` to the `DocumentType` Prisma enum (`prisma/schema.prisma`, alongside the existing
  `SLIDES`). `SLIDES` stays the "uploaded .pptx file" type; `DECK` is the "native editable deck".
- Store the structured deck JSON. `Document.content` is currently `@db.Text` holding *extracted
  text*, so we either (a) add a dedicated `Json` column (e.g. `deckContent Json?`) or (b) reuse
  `content` for the JSON and keep derived text elsewhere. **Recommendation:** add a nullable
  `deckContent Json?` column so `content` can remain the search/index plain-text (consistent with
  how `Document.content` already feeds indexing), and `storagePath` stays null for native decks.
- Pros: documents already model `type`, per-folder placement, and the cloud grid already has a
  `SLIDES`/`Presentation` icon. Cons: documents have no editing API today (PATCH only touches
  `title`/`folderId`), so we add deck content endpoints.

**Option B — reuse the `Page` model with a `kind`/`type` discriminator.**
- Pages already have editable `content: Json`, `plainText`, versions, **and the Yjs collab stack**.
- Cons: every Page is assumed to be BlockNote across the app (sidebar, mind-map link extraction,
  page-view, versions). Adding a non-BlockNote page kind risks regressions in all of those.

> **Chosen:** Option A (`DECK` document type + `deckContent Json`). It isolates the new content type,
> keeps Pages purely BlockNote, and matches the existing `SLIDES` mental model. The Yjs work in
> Phase 2 is bespoke for Konva regardless of which model we pick (BlockNote's binding doesn't apply
> to a canvas), so Option B's collab "head start" doesn't actually help.

### 6.2 Deck JSON schema (Yjs-friendly)

Flat, id-keyed maps with stable ids and no nested arrays-of-primitives, so it maps cleanly onto Yjs
shared types later (`Y.Array<slideId>` + `Y.Map` per slide + `Y.Map` per element).

```ts
type DeckDoc = {
  version: 1;
  size: { w: 1280; h: 720 };        // fixed 16:9 canvas
  slideOrder: string[];             // ordered slide ids
  slides: Record<string, Slide>;    // id -> slide (flat map, not array)
  theme?: { background?: string; fontFamily?: string };
};

type Slide = {
  id: string;
  background?: string;              // hex / css color
  elementOrder: string[];          // z-order, back -> front
  elements: Record<string, Element>;
};

type ElementBase = {
  id: string;
  x: number; y: number;             // top-left, canvas coords
  w: number; h: number;
  rotation: number;                 // degrees
  opacity?: number;
};

type TextElement = ElementBase & {
  type: "text";
  text: string;
  fontSize: number; fontFamily: string; fontWeight?: number;
  color: string; align?: "left" | "center" | "right";
};

type ImageElement = ElementBase & {
  type: "image";
  src: string;                      // /api/documents/:id/raw or asset URL
  documentId?: string;              // provenance if from a library file
};

type ShapeElement = ElementBase & {
  type: "shape";
  shape: "rect" | "ellipse" | "line";
  fill?: string; stroke?: string; strokeWidth?: number; radius?: number;
};

type Element = TextElement | ImageElement | ShapeElement;
```

**Derived search text:** on save, walk all slides → concatenate `TextElement.text` → store in
`Document.content` and run the existing `indexDocument()` path so decks are searchable.

### 6.3 Rendering

- A fixed **1280×720** Konva `Stage` scaled to fit the viewport (responsive scale factor, never
  re-layouts element coordinates).
- Elements render as `Text` / `Image` / `Rect` / `Ellipse` / `Line`. Selection uses Konva's
  `Transformer` for resize/rotate; drag-to-move is native Konva draggable.
- **Inline text editing:** standard Konva pattern — on double-click, overlay a positioned HTML
  `<textarea>` matching the node's box/scale, write back on blur.
- Thumbnail rail renders mini read-only Stages (or cached `toDataURL` snapshots) per slide.

### 6.4 API endpoints (Phase 1)

Mirror the Pages API shape, scoped to decks:

| Route | Method | Purpose |
|---|---|---|
| `/api/documents` | POST | Create a `DECK` doc (no file; `type: "DECK"`, empty `deckContent`). Extend or branch the existing multipart upload route to accept a JSON create. |
| `/api/documents/[id]` | GET | Already returns the doc; include `deckContent`. |
| `/api/decks/[id]` | PATCH | Save `deckContent` (+ derived text + re-index). New route to avoid overloading the file-oriented document PATCH. |
| `/api/decks/[id]/export` | GET | Server-side `.pptx` generation via `pptxgenjs`, streamed as a download. *(Could also be client-side; server keeps fonts/assets consistent.)* |

> Asset images dropped onto slides reuse the existing document/asset upload + `/api/documents/:id/raw`
> streaming and auth (session cookie, library access checks).

### 6.5 Routing & navigation

- New helper in `src/lib/client/routes.ts`: `deckRoute(libraryId, deckId)` →
  `/library/{libraryId}/decks/{deckId}`.
- New app route `src/app/library/[libraryId]/decks/[deckId]/page.tsx` → `<DeckView />` inside the
  existing `LibraryShell`.
- Sidebar/grid: decks appear under `FolderNode.documents` (type `DECK`) — reuse the existing
  document row, dnd id (`{ type: "document", docType: "DECK" }`), `Presentation` icon, and
  move/delete actions. **No new tree array needed**, which keeps `buildFolderTree`, breadcrumbs, and
  `sidebar-dnd` untouched.
- "New" entry points: add **New deck** to the cloud-view `QuickActions` "New" dropdown and the
  `CloudToolbar` `New` menu (next to New page / New folder).

## 7. UX scope (Phase 1)

- **Editor chrome:** top toolbar (add text / image / shape, font size, color, bold, alignment,
  z-order front/back, duplicate, delete), left thumbnail slide rail (add / reorder via dnd-kit /
  duplicate / delete), main canvas, right contextual properties for the selected element.
- **Slide rail reorder:** reuse the existing dnd-kit setup (`src/lib/client/sidebar-dnd.ts` patterns)
  for drag-to-reorder.
- **Present mode:** fullscreen overlay, one slide at a time, `←/→/Space` to navigate, `Esc` to exit,
  scaled to screen.
- **Autosave:** debounced PATCH (same UX as page-view's save status: idle / saving / saved).
- **Empty state:** a new deck opens with one blank slide and a hint to add a text box.

## 8. Phase 2 — Real-time collaboration (Yjs)

Layered onto the Phase-1 schema. Reuses existing transport/persistence
(`src/lib/collab/*`, Pusher + Redis), but the **Konva⇄Yjs binding is bespoke** (BlockNote's binding
does not apply to a canvas).

- Model the deck as shared types: `Y.Array<slideId>` (order) + `Y.Map` of slides, each slide a
  `Y.Map` with `Y.Array<elementId>` + `Y.Map` of element `Y.Map`s.
- Two-way sync: Yjs observers → Konva re-render; local edits → Yjs mutations. **Throttle** drag/resize
  ops (e.g. on `dragmove`/`transform`, commit on end + sampled intermediate frames).
- **Awareness:** live selection + cursors per collaborator (reuse `user-colors`, awareness protocol).
- Durable save still via the deck PATCH (same as pages keep PATCHing in collab mode).
- Fallback: when Pusher/Redis aren't configured, decks behave single-user (no polling needed for a
  canvas; last-write-wins on save), mirroring how pages degrade.

## 9. Milestones

**Phase 1 — MVP editor (this is the "yes, soon" chunk; ~8–12 files)**
1. Schema + migration: `DECK` enum value, `deckContent Json?`, deck create + PATCH endpoints,
   `deckRoute`, app route.
2. Canvas core: scaled 1280×720 Stage, render elements, selection + `Transformer`, drag/resize/rotate.
3. Element tooling: add/edit text (textarea overlay), image (from upload/library), shapes; color /
   font / z-order / duplicate / delete.
4. Slide rail: add / reorder (dnd-kit) / duplicate / delete + thumbnails.
5. Present mode (fullscreen + keyboard nav).
6. Autosave + derived-text indexing; sidebar/grid/New-menu integration.
7. `.pptx` export via `pptxgenjs`.

**Phase 2 — Collaboration**
8. Bespoke Konva⇄Yjs binding (shared types, observers, throttled ops).
9. Awareness (live selection/cursors), conflict-safe drag, presence UI.

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Inline text editing on canvas is fiddly | Use the documented Konva textarea-overlay pattern; keep text styling minimal in v1. |
| Custom Yjs binding is the real cost of collab | Phase it; ship single-user first with a collab-shaped schema (flat maps, stable ids). |
| `.pptx` fidelity (fonts, positioning) | Map our fixed 1280×720 coords directly to pptx EMUs; restrict to a known font set in v1. |
| Document model has no content-edit API today | Add dedicated `/api/decks/[id]` PATCH rather than overloading the file-oriented document routes. |
| Many image elements / large decks | Lazy-load images, cache thumbnail `toDataURL`, cap embedded asset sizes. |
| Indexing decks for search | Derive plain text from text elements on save and reuse `indexDocument()`. |

## 11. Success metrics

- A user can create, edit (text/image/shape), reorder, present, and export a deck end-to-end without
  leaving Recall.
- Deck content appears in library search results.
- Phase 2: two users edit the same deck concurrently with visible live selections and no lost edits.

## 12. Open questions

- Dedicated `deckContent Json` column vs. reusing `content` for JSON — confirm migration approach.
- Should export be **server-side** (consistent fonts/assets) or **client-side** (simpler, no server
  asset fetch)? Leaning server-side.
- Do we need speaker notes in v1, or defer with the rest of presenter features? (Currently deferred.)
- Asset model: reuse page-assets bucket for slide images, or a deck-specific path?

---

### Appendix — relevant existing code

- `prisma/schema.prisma` — `Document` / `DocumentType` enum (has `SLIDES`, no `DECK`), `Page`.
- `src/components/views/document-view.tsx` — current (read-only) `SLIDES` rendering.
- `src/components/views/page-view.tsx` — closest precedent for an editable, autosaving, collab view.
- `src/lib/collab/*`, `src/hooks/use-collab-session.ts` — Yjs transport/persistence (Pusher + Redis).
- `src/lib/client/routes.ts`, `src/app/library/[libraryId]/**` — routing patterns.
- `src/lib/library/folders.ts`, `src/components/sidebar/folder-sidebar.tsx` — tree/sidebar.
- `src/components/cloud/cloud-view.tsx` — cloud grid + `QuickActions` "New" menu.
