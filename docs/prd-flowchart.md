# PRD — Flowchart (editable node/edge diagrams)

**Status:** Draft · **Owner:** Alan · **Last updated:** 2026-06-15
**Sibling docs:** `docs/prd-whiteboard.md` (freehand canvas), `docs/prd-databases.md` (the other new
native type), `docs/prd-pdf-annotations.md` (uploaded PDF markup). The whiteboard PRD's §12 explicitly flagged a "node/flow board" built on React Flow as a
separate thing from the freehand whiteboard — this is that thing.

---

## 1. Summary

Add an **editable Flowchart** to Recall: a node-and-edge diagram editor where users drop labeled nodes,
connect them with arrows, and lay out processes / decision trees / org charts. Like decks and
whiteboards, a flowchart is **first-class native content** in a library/folder (created, renamed, moved,
deleted, searched) — not an uploaded file.

It is built on **`@xyflow/react` (React Flow)** — **already a dependency**, currently used **read-only**
in the mind map (`src/components/views/mind-map-view.tsx`). This feature makes React Flow **editable**
(add nodes, connect edges, edit labels, move/delete), so the incremental cost is small.

> **Flowchart vs. Whiteboard:** the whiteboard is freehand (Konva strokes/shapes/sticky notes). The
> flowchart is structured (typed nodes + real connections that re-route when nodes move). Different
> tools for different jobs; they intentionally use different engines (Konva vs. React Flow).

## 2. Goals & non-goals

### Goals (v1)
- Create / open / rename / move / delete a flowchart, surfaced in the sidebar tree, cloud grid, and
  "New" menus like decks/pages/whiteboards.
- **Nodes:** add via toolbar/double-click; edit the label inline; pick a shape
  (`rectangle` / `rounded` / `ellipse` / `diamond`) and a color; drag to move; resize is deferred (auto
  size to label in v1); delete.
- **Edges:** connect node→node by dragging from a handle; optional edge label; delete; arrowheads.
- Pan / zoom / fit-view / minimap (reuse the mind-map's React Flow setup), with **editing enabled**
  (`nodesConnectable`, `nodesDraggable`, `onConnect`, etc.).
- **Auto-layout** button (top-to-bottom) using **`dagre`** — already a dependency (used by the mind map
  layout).
- Persist the diagram as JSON (our own schema) with **debounced autosave + save status**, reusing the
  whiteboard/deck **patch** pattern.
- **Indexable:** node + edge labels feed the existing search/index pipeline.

### Non-goals (v1)
- Real-time multiplayer (Yjs). Last-writer-wins via debounced autosave, like the whiteboard v1.
- Freehand drawing, images, sticky notes (that's the whiteboard).
- Sub-flows/groups, custom handle routing, swimlanes, conditional styling, export to image (PNG export
  is a natural fast-follow via the React Flow `toPng` util / `html-to-image`).
- Mermaid-style text-to-diagram (explicitly out — the user wants a direct, visual editor).

## 3. Architecture & data model

Reuses the **"native editable content"** pattern (`DocumentType` + JSON column + patch PATCH route).

### 3.1 Storage
- Add `FLOWCHART` to the `DocumentType` Prisma enum.
- Store the scene in a nullable column **`flowContent Json?`**. `Document.content` stays the derived
  text for search; `storagePath` stays null.

### 3.2 Scene schema (`src/lib/flowcharts/flowchart-schema.ts`)
Flat, id-keyed maps + order arrays, matching board/deck/database.

```ts
type NodeShape = "rectangle" | "rounded" | "ellipse" | "diamond";

type FlowNode = {
  id: string;
  x: number; y: number;
  label: string;
  shape: NodeShape;
  color: string;     // accent color key/hex
};

type FlowEdge = {
  id: string;
  source: string; target: string;
  label?: string;
};

type FlowDoc = {
  version: 1;
  nodes: Record<string, FlowNode>;
  nodeOrder: string[];
  edges: Record<string, FlowEdge>;
  edgeOrder: string[];
};
```

`createEmptyFlow()` seeds a single "Start" node. `normalizeFlow(json)` coerces unknown/null JSON;
`applyFlowPatch(scene, patch)` merges purely (deleting a node also deletes its incident edges);
`deriveFlowText(scene)` concatenates node + edge labels for indexing.

```ts
type FlowPatch = {
  nodes?: { upserts?: Record<string, FlowNode>; deletes?: string[] };
  edges?: { upserts?: Record<string, FlowEdge>; deletes?: string[] };
  nodeOrder?: string[];
  edgeOrder?: string[];
};
```

### 3.3 API endpoints (v1)
| Route | Method | Purpose |
|---|---|---|
| `/api/documents` | POST (JSON) | Create a `FLOWCHART` doc with `createEmptyFlow()`. |
| `/api/flowcharts/[id]` | GET | Return `{ id, title, folderId, libraryId, scene }`. |
| `/api/flowcharts/[id]` | PATCH | Apply a `FlowPatch`, persist, re-derive text + reindex. |

Mirrors `src/app/api/boards/[id]/route.ts`.

### 3.4 Routing & navigation
- `flowchartRoute(libraryId, id)` → `/library/{libraryId}/flowcharts/{id}`.
- App route `src/app/library/[libraryId]/flowcharts/[flowchartId]/page.tsx` → `<FlowchartView />`.
- `documentOpenRoute()` maps `FLOWCHART` → `flowchartRoute`.
- Flowcharts ride `FolderNode.documents` (type `FLOWCHART`); reuse the document row, dnd id, move/delete,
  and a new icon/label/colors in `file-icons.tsx`.
- Add **New flowchart** to the cloud "New" menus; add `createFlowchart()` to `LibraryShell` context;
  `createNativeDocument()` accepts `FLOWCHART`.

## 4. UX scope (v1)
- Full-bleed React Flow canvas inside the library shell with **our own** toolbar (add node, choose
  shape + color, auto-layout, delete selection, fit view) styled to match the app.
- Custom node type (one `editableNode`) rendered with our design tokens; inline label editing on
  double-click; connection handles on hover.
- Top bar: title (rename), save status (idle/saving/saved), read-only badge for `VIEWER`.
- Autosave: debounced `PATCH /api/flowcharts/:id` translating React Flow changes → `FlowPatch`.
- Empty state: a starter "Start" node with a hint to double-click the canvas to add a node and drag
  from a node's handle to connect.

## 5. Milestones
1. Schema + migration (`FLOWCHART`, `flowContent`); `flowchart-schema.ts`; create + GET/PATCH
   endpoints; `flowchartRoute`; app route; file-icons + "New" menu wiring.
2. `<FlowchartView />`: editable React Flow (add/move/connect/edit/delete), custom node, toolbar,
   autosave + save status.
3. Auto-layout (dagre), derived-text indexing, polish (empty state, read-only).

## 6. Risks & mitigations
| Risk | Mitigation |
|---|---|
| React Flow controlled-state churn | Debounce autosave; translate `onNodesChange`/`onEdgesChange` into coalesced patches. |
| Deleting a node orphaning edges | `applyFlowPatch` removes incident edges on node delete. |
| Divergence from mind-map setup | Share React Flow config conventions; flowchart adds editing handlers only. |
| Scene JSON growth | Labels only; no inline images; reasonable node caps. |

## 7. Success metrics
- A user can create a flowchart, add and connect labeled nodes, auto-layout, autosave, and reopen it
  without leaving Recall.
- Node/edge labels appear in library search.

## 8. Open questions
- PNG/SVG export in v1 or fast-follow? (Leaning fast-follow.)
- Single `editableNode` type vs. per-shape node types (leaning one node type, shape as data).
- Should auto-layout overwrite manual positions or offer undo? (v1: overwrite, it's an explicit action.)

---

### Appendix — relevant existing code
- `src/components/views/mind-map-view.tsx` — existing **read-only** React Flow + `dagre` layout.
- `src/lib/pages/mind-map-layout.ts` — dagre layout helper to mirror.
- `src/lib/boards/board-schema.ts`, `src/app/api/boards/[id]/route.ts`,
  `src/components/whiteboard/board-view.tsx` — patch schema / API / autosave templates.
- `src/lib/client/routes.ts`, `src/lib/client/file-icons.tsx`, `src/components/cloud/cloud-toolbar.tsx`,
  `src/components/library/library-shell.tsx` — routing / icons / "New" menu wiring.
