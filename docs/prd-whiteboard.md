# PRD — Whiteboard

**Status:** Draft · **Owner:** Alan · **Last updated:** 2026-06-14
**Sibling doc:** `docs/prd-slideshows.md` (shares the "native editable canvas content" pattern)

---

## 1. Summary

Add an **infinite-canvas whiteboard** to Recall: freehand drawing, sticky notes, shapes, text,
arrows/connectors, and images on a pannable/zoomable surface. Like the deck editor, a whiteboard is
**first-class editable content** inside a library/folder (created, renamed, moved, deleted, searched)
— not an uploaded file.

The whiteboard is built on the **same `react-konva` engine as the deck editor** — one owned,
fully on-brand canvas stack for both products — and **skips Yjs for v1** in favor of a simple
**soft edit-lock** ("being edited by Alan"). It's still a smaller project than slides because there's
no Yjs and it reuses the deck's canvas foundation.

> **Why not a drop-in library?** Excalidraw is the obvious "fast" choice, but it is **not headless** —
> it ships an opinionated, hand-drawn aesthetic and its own toolbar that we can't reskin to match the
> corporate UI. tldraw is more customizable but needs a paid production license. We chose `react-konva`
> to keep full design control and share one engine with the deck editor (see §5 for the full comparison).

## 2. How this differs from Slideshows (and why it's still easier)

| | Slideshows (deck) | Whiteboard |
|---|---|---|
| Canvas | `react-konva` (shared engine) | **`react-konva` (same shared engine)** |
| Surface | Fixed 1280×720 slides + slide rail | **Infinite, pan/zoom scene** (one canvas) |
| Extra canvas work | Slide rail, transformer, text overlay, present mode | **Freehand strokes, pan/zoom, arrows/connectors** |
| Collaboration v1 | Phase 2 Yjs (bespoke Konva⇄CRDT binding) | **No Yjs** — soft lock while editing |
| Export | `.pptx` via `pptxgenjs` | PNG via Konva `stage.toDataURL()` (SVG later) |

> **Net:** both editors sit on the same Konva foundation, so we build shared primitives (element model,
> selection/`Transformer`, drag/resize/rotate, text overlay) **once** and reuse them. The whiteboard
> adds infinite pan/zoom + freehand; in exchange it drops the entire collab phase (soft lock instead of
> Yjs). That trade is what keeps it the smaller project.

## 3. Direct answers to the framing questions

- **"This should be easier, right?"** Yes — but the saving is from **no Yjs** and **reusing the deck's
  canvas foundation**, not from a drop-in library (we deliberately avoided Excalidraw's baked-in look).
- **"Does a whiteboard even need Yjs?"** No, not for v1. Whiteboards are most often single-author or
  turn-based. We can ship a great single-editor experience and add real-time later if there's demand.
- **"Just lock something when it's being edited?"** Exactly the recommended model: a **soft
  pessimistic lock** — one editor at a time, everyone else sees it live-ish but **read-only** with a
  "being edited by X" banner. Far simpler than CRDT and good enough for the common case.

## 4. Goals & non-goals

### Goals
- Create / open / rename / move / delete a whiteboard within a library or folder, surfaced in the
  sidebar tree and cloud grid like decks/pages.
- Whiteboard editing on our Konva canvas: freehand strokes, shapes (rect/ellipse/line), text,
  sticky notes, arrows/connectors, images, multi-select, infinite pan/zoom.
- Persist the scene as JSON (our own schema); autosave with a visible save status.
- Export to **PNG** (Konva `stage.toDataURL()`); SVG/PDF as later follow-ons.
- **Soft edit-lock** so two people don't silently clobber each other.
- Indexable: derived text from text/sticky elements feeds the existing search/index pipeline.
- **Reuse the deck editor's canvas primitives** (element model, selection/transformer, drag/resize).

### Non-goals (v1)
- Real-time multiplayer (Yjs) co-editing. Deferred; see §8.
- Operational merge of concurrent edits (lock avoids the need).
- Templates, libraries of shapes, presentation/follow mode, voting/timers.
- Mobile editing (view should work; editing is desktop-first).
- Importing arbitrary images-as-board or OCR of drawings.

## 5. Tech choice (canvas engine)

**Chosen: [`react-konva`](https://konvajs.org/) (MIT) — shared with the deck editor.**
- Full design control: the whiteboard looks like *our* product, matching the corporate UI we tuned.
- One owned engine for deck + board → shared element model, selection/`Transformer`, drag/resize,
  text overlay, and export utilities. We build those primitives once.
- Cost: we implement infinite pan/zoom, freehand stroke capture, and arrows ourselves (all standard,
  well-documented Konva patterns). More code than a drop-in, but no design clash and no license.

**Alternatives considered (and why not):**
- **`@excalidraw/excalidraw` (MIT)** — fastest to ship and batteries-included, but **not headless**:
  it imposes a hand-drawn aesthetic and its own toolbar that can't be reskinned to match our UI. Theming
  is light/dark + hide-some-chrome only. Rejected for design consistency.
- **`tldraw`** — modern, neutral look and highly customizable (you can replace its UI), but production
  use / watermark removal needs a **commercial license**. Rejected on cost/licensing.
- **`@xyflow/react` (React Flow)** — *already a dependency* (mind map). Node/edge diagramming, **not**
  freehand whiteboarding. Only relevant if "whiteboard" really means a flow/diagram board (see §12).

> **Shared module:** factor the deck + board common canvas code into something like
> `src/components/canvas/*` (element rendering, selection, transformer, hit-testing, image loading,
> PNG export) so both editors import it. Build it during the deck work; the board extends it.

## 6. Architecture & data model

Reuses the same "native editable canvas content" pattern as the deck PRD.

### 6.1 Storage
- Add a value to the `DocumentType` Prisma enum (`prisma/schema.prisma`) — e.g. **`WHITEBOARD`**
  (alongside `SLIDES`, and the proposed `DECK`).
- Store our **own Konva-based scene JSON** in a nullable column — e.g. **`boardContent Json?`** (or a
  shared `canvasContent Json?` reused by deck + board). `Document.content` (`@db.Text`) stays the
  derived plain text for search/indexing; `storagePath` stays null for native boards.
- Embedded images: store via the existing document/asset upload + `/api/documents/:id/raw` streaming;
  the scene references our asset URLs, reusing current auth/library-access checks.

**Scene schema (Yjs-friendly, like the deck's).** Flat, id-keyed maps with stable ids. The board is a
single infinite layer of elements (no slides), and adds a `path` element type for freehand:

```ts
type BoardDoc = {
  version: 1;
  viewport?: { x: number; y: number; zoom: number }; // last camera (per-user later)
  elementOrder: string[];                              // z-order
  elements: Record<string, BoardElement>;             // id -> element (flat map)
};

// Shares ElementBase / text / image / shape with the deck (src/components/canvas),
// plus freehand and connectors:
type PathElement = ElementBase & { type: "path"; points: number[]; stroke: string; strokeWidth: number };
type ArrowElement = ElementBase & { type: "arrow"; points: number[]; stroke: string; fromId?: string; toId?: string };
```

### 6.2 Edit lock (the collaboration model for v1)
Pessimistic, single-writer lock with a short TTL + heartbeat.

- Fields on the board record (or a small `BoardLock` row): `lockedById`, `lockedByName`,
  `lockExpiresAt`.
- **Acquire** on entering edit mode: `POST /api/boards/[id]/lock` — succeeds if free or already held
  by the requester; otherwise returns the current holder.
- **Heartbeat** every ~20s extends `lockExpiresAt` (TTL ~60s) while the editor is active.
- **Release** on close/unload (`beforeunload` + explicit DELETE); auto-expires via TTL if the tab
  dies.
- **Non-holders** open **read-only** with a banner: *"Being edited by {name}"* + a **Request edit /
  Take over** action (immediate once the lock has expired).
- **Live-ish updates:** if Pusher is configured (`src/lib/collab/config.ts`), push lock changes +
  scene-saved events so readers refresh; otherwise fall back to polling (precedent:
  `src/hooks/use-page-collaboration.ts` + `PagePresence`). No CRDT either way.

> This is intentionally last-writer-wins at the document level, gated by the lock — simple, debuggable,
> and adequate for whiteboards.

### 6.3 API endpoints (v1)
| Route | Method | Purpose |
|---|---|---|
| `/api/documents` | POST | Create a `WHITEBOARD` doc (no file; empty scene). |
| `/api/documents/[id]` | GET | Returns the doc incl. `boardContent`. |
| `/api/boards/[id]` | PATCH | Save scene JSON (+ derived text + re-index). |
| `/api/boards/[id]/lock` | POST / DELETE | Acquire+heartbeat / release the edit lock. |

### 6.4 Routing & navigation
- `boardRoute(libraryId, boardId)` → `/library/{libraryId}/boards/{boardId}` in
  `src/lib/client/routes.ts`.
- App route `src/app/library/[libraryId]/boards/[boardId]/page.tsx` → `<BoardView />` inside
  `LibraryShell`.
- Sidebar/grid: boards ride `FolderNode.documents` (type `WHITEBOARD`) — reuse the document row, dnd
  id (`{ type: "document", docType: "WHITEBOARD" }`), move/delete actions, and a board icon
  (e.g. `PencilRuler` / `Frame`) in `src/lib/client/file-icons.tsx`.
- "New" entry points: add **New whiteboard** to the cloud-view `QuickActions` "New" dropdown and the
  `CloudToolbar` `New` menu.

## 7. UX scope (v1)
- Full-bleed Konva canvas inside the library shell with **our own** toolbar (select, pen/freehand,
  text, sticky, shape, arrow, image, color/stroke, z-order, delete) — styled to match the app.
- Infinite pan (space-drag / scroll) and zoom (ctrl/⌘-scroll or controls); selection + `Transformer`
  reused from the deck canvas module.
- Top bar: title (rename), save status (idle/saving/saved), export menu (PNG), lock banner when read-only.
- Autosave: debounced `PATCH /api/boards/[id]` on scene change (skip while read-only).
- Empty state: blank canvas with a hint toward the toolbar.

## 8. Later: real-time collaboration (optional, deferred)
If demand appears, upgrade from soft-lock to multiplayer:
- This is the **same bespoke Konva⇄Yjs binding** described in the deck PRD's Phase 2 (model the scene
  as `Y.Array<elementId>` + `Y.Map` per element, observers → Konva, throttled drag ops, awareness).
- We already have transport/persistence (`src/lib/collab/*`, Pusher + Redis). Still a separate project
  (awareness, scene diffing, throttling). Explicitly **not** in v1 — and arguably never needed if the
  soft lock proves sufficient.

## 9. Milestones (v1 — small)
1. Schema + migration: `WHITEBOARD` enum value, `boardContent Json?`, create + PATCH endpoints,
   `boardRoute`, app route.
2. `<BoardView />` on the shared Konva canvas module: render/edit scene, infinite pan/zoom, freehand +
   shapes + text + sticky + arrow + image; autosave + save status.
3. Edit lock: acquire/heartbeat/release, read-only banner + take-over, Pusher push or polling.
4. Derived-text indexing; sidebar/grid/New-menu integration; PNG export.

> Depends on the deck editor landing first (or at least the shared `src/components/canvas` module),
> since the board reuses those primitives.

## 10. Risks & mitigations
| Risk | Mitigation |
|---|---|
| More build effort than a drop-in | Reuse the deck's shared canvas module; board only adds pan/zoom + freehand + arrows. |
| Freehand perf with many strokes | Simplify/decimate stroke points; batch into a single Konva `Line`; cache static layers. |
| Stale lock if a tab dies | Short TTL + heartbeat; take-over allowed once expired. |
| Two readers both "take over" at expiry | Server-side compare-and-set on `lockExpiresAt`; loser gets read-only. |
| Scene JSON can grow large | Store images as assets (refs), not inline base64; cap asset sizes. |
| Indexing a drawing | Derive text from text/sticky elements only; reuse `indexDocument()`. |

## 11. Success metrics
- A user can create, draw on, autosave, export, and reopen a whiteboard without leaving Recall.
- Concurrent access never silently clobbers: the second user sees read-only + a clear owner.
- Whiteboard text appears in library search.

## 12. Open questions
- **Whiteboard vs. diagram board:** true freehand whiteboard (→ our Konva canvas, as decided) or a
  node/flow board (→ reuse React Flow, already a dependency)? Default: **freehand whiteboard / Konva**.
- Shared `canvasContent Json` column + shared `src/components/canvas` module for deck + board, or keep
  separate `deckContent` / `boardContent`? (Leaning shared module, separate-or-shared column TBD.)
- Lock fields on the `Document` row vs. a dedicated `BoardLock` table?
- Is read-only "live refresh" needed in v1, or is open-time snapshot + manual refresh enough?
- Sequencing: build the shared canvas module as part of the deck editor, then the board — confirm order.

---

### Appendix — relevant existing code
- `prisma/schema.prisma` — `Document` / `DocumentType` enum.
- `src/hooks/use-page-collaboration.ts`, `prisma` `PagePresence` — polling/presence precedent for the lock fallback.
- `src/lib/collab/config.ts` — `isCollabConfigured()` (Pusher + Redis) for instant lock updates.
- `src/lib/client/routes.ts`, `src/app/library/[libraryId]/**` — routing patterns.
- `src/lib/library/folders.ts`, `src/components/sidebar/folder-sidebar.tsx` — tree/sidebar.
- `src/components/cloud/cloud-view.tsx` — cloud grid + `QuickActions` "New" menu.
- `src/components/views/mind-map-view.tsx` — existing `@xyflow/react` (React Flow) usage.
