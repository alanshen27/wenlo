# PRD — Databases (Table / Sheet · Kanban · Calendar)

**Status:** Draft · **Owner:** Alan · **Last updated:** 2026-06-15
**Sibling docs:** `docs/prd-whiteboard.md`, `docs/prd-slideshows.md` (share the "native editable
content" pattern), `docs/prd-flowchart.md` (the other new native type).

---

## 1. Summary

Add a **Database** to Recall: a structured, Notion-style collection of typed records that can be
viewed three ways — as a **Table (Sheet)**, a **Kanban board**, and a **Calendar**. Like decks and
whiteboards, a database is **first-class editable content** inside a library/folder (created, renamed,
moved, deleted, searched) — not an uploaded file.

The key idea: **Sheet, Kanban, and Calendar are not three features — they are three views of one
"db page."** The Sheet view is the base table; Kanban groups the same rows by a select property;
Calendar lays the same rows out by a date property. One data model, one document, three lenses.

## 2. Why this shape

- **Sheet = the database.** A spreadsheet-like grid of rows × typed columns is the natural base
  abstraction. Everything else is a projection of it.
- **Kanban = "group rows by a single-select property."** Columns are the options of that property;
  dragging a card between columns just sets the property on that row.
- **Calendar = "place rows on a date property."** Each row with a date appears on that day; dragging
  to another day sets the date.

Because all three read/write the **same rows**, we get task boards, simple spreadsheets, and content
calendars from a single, maintainable model with no per-view data duplication.

## 3. Goals & non-goals

### Goals (v1)
- Create / open / rename / move / delete a database within a library or folder, surfaced in the
  sidebar tree, cloud grid, and "New" menus like decks/pages/whiteboards.
- **Properties (typed columns):** `text`, `number`, `select` (single, colored options), `date`,
  `checkbox`. Add / rename / retype / reorder / delete a property.
- **Rows:** add / edit cells inline / delete / reorder.
- **Table view (Sheet):** editable grid; click a cell to edit; add column / add row affordances.
- **Board view (Kanban):** pick a `select` property to group by; columns are its options (+ an
  "Uncategorized" lane); drag cards between columns to set the property; add a card to a column.
- **Calendar view:** pick a `date` property; month grid; rows render on their day; drag to reschedule;
  add a row on a day. Rows without a date sit in an "Unscheduled" tray.
- **Multiple saved views** per database (e.g. "All tasks" table + "By status" board + "Schedule"
  calendar), with the active view persisted in the doc.
- Persist the whole database as JSON (our own schema) with **debounced autosave + save status**,
  reusing the whiteboard/deck **patch** persistence pattern.
- **Indexable:** derived text from text/number/select/date cells feeds the existing search/index
  pipeline (`indexDocument`).

### Non-goals (v1)
- Real-time multiplayer co-editing (Yjs). Last-writer-wins at the document level via debounced
  autosave, exactly like the whiteboard v1. Deferrable later.
- Formulas, rollups, relations between databases, filters/sorts UI, grouping in the table view.
- Property types beyond the five above (multi-select, person, files, URL, etc.).
- Per-user view state, sharing a single view by link, CSV import/export (CSV import is a natural
  fast-follow given the existing `SHEET` extraction).

## 4. Architecture & data model

**Decision (2026-06-15):** the database is **relational, not a JSON blob**, so rows/cells stay
queryable in SQL (filter / sort / aggregate, and future Recall querying). The `DATABASE` **Document**
is only the *container* (folder placement, title, indexing); the actual data lives in dedicated child
tables keyed to it. This is the one place we deliberately diverge from the `boardContent`/`deckContent`
JSON pattern.

### 4.1 Storage (relational, EAV-typed)
Add `DATABASE` to the `DocumentType` enum. `Document.content` (`@db.Text`) stays the derived plain text
for search; `storagePath` and the canvas JSON columns stay null. New tables (`prisma/schema.prisma`):

```prisma
enum DatabasePropertyType { TEXT NUMBER SELECT DATE CHECKBOX }
enum DatabaseViewType     { TABLE BOARD CALENDAR }

model DatabaseProperty {            // a column
  id, documentId, name,
  type DatabasePropertyType,
  options Json?,                    // SELECT only: [{id,label,color}] (config, not row data)
  position Int, width Int?
}

model DatabaseRow {                 // a record
  id, documentId, position, createdAt, updatedAt
}

model DatabaseCell {                // one typed value at (row × property)
  id, rowId, propertyId,
  valueText String?  @db.Text,
  valueNumber Float?,
  valueDate DateTime? @db.Date,     // date-only, compared/queried in UTC
  valueBool Boolean?,
  valueOptionId String?,            // SELECT: chosen option id
  @@unique([rowId, propertyId])
}

model DatabaseView {                // a saved Table/Board/Calendar view
  id, documentId, name,
  type DatabaseViewType,
  config Json?,                     // BOARD:{groupPropertyId} CALENDAR:{datePropertyId}
  position Int
}
```

Exactly one `value*` column is populated per cell, chosen by the property's `type`. Every value is
therefore natively queryable/sortable (e.g. `WHERE valueOptionId = …` to count a Kanban lane,
`ORDER BY valueDate` for a calendar range) instead of being trapped in JSON. Indexes:
`DatabaseRow(documentId, position)`, `DatabaseCell(rowId)`, `DatabaseCell(propertyId, valueOptionId)`.

`select` **options** and **view config** stay as small JSON — they're configuration, not row data, and
are never filtered on.

### 4.2 Client scene shape (`src/lib/databases/database-schema.ts`)
The API assembles the relational rows into a normalized scene for the client and maps back on write.
This module holds the shared TS types + the cell value codec (CellValue ⇄ typed columns) +
`deriveDatabaseText()` + the default-seed definition used at creation.

```ts
type CellValue = string | number | boolean | null; // select -> optionId, date -> "yyyy-mm-dd"
type DatabaseScene = {
  id; title; folderId; libraryId;
  properties: DatabaseProperty[];                   // ordered
  rows: { id: string; position: number; cells: Record<string /*propertyId*/, CellValue> }[];
  views: DatabaseView[];                            // ordered
};
```

**Seed at creation:** a `TEXT` "Name" property (primary), a `SELECT` "Status"
(`Todo / In progress / Done`), a `DATE` "Due", three empty rows, and three views — Table "All",
Board "By status" (group = Status), Calendar "Schedule" (date = Due).

### 4.3 API endpoints (v1)
RESTful sub-resources; each mutation re-derives `Document.content` and reindexes via `after()`
(`reindexDatabase(documentId, userId)` helper), mirroring `src/app/api/boards/[id]/route.ts` auth.

| Route | Method | Purpose |
|---|---|---|
| `/api/documents` | POST (JSON) | Create a `DATABASE` doc + seed default properties/rows/views (txn). |
| `/api/databases/[id]` | GET | Assemble + return the full `DatabaseScene`. |
| `/api/databases/[id]/properties` | POST / PATCH | Add a column / reorder columns. |
| `/api/databases/[id]/properties/[propertyId]` | PATCH / DELETE | Rename/retype/options / delete column (cascades cells). |
| `/api/databases/[id]/rows` | POST / PATCH | Add a row / reorder rows. |
| `/api/databases/[id]/rows/[rowId]` | PATCH / DELETE | Set cell values (upsert) + position / delete row. |
| `/api/databases/[id]/views` | POST | Add a view. |
| `/api/databases/[id]/views/[viewId]` | PATCH / DELETE | Rename / change group/date property / delete. |

Cell writes go through `PATCH /rows/[rowId]` with `cells: { [propertyId]: CellValue }`; the server
upserts each `DatabaseCell` into the right typed column. Kanban drag = set the group `SELECT` cell;
calendar drag = set the `DATE` cell. The active view is remembered client-side (per-doc localStorage).

### 4.4 Routing & navigation
- `databaseRoute(libraryId, dbId)` → `/library/{libraryId}/databases/{dbId}` (`src/lib/client/routes.ts`).
- App route `src/app/library/[libraryId]/databases/[databaseId]/page.tsx` → `<DatabaseView />`.
- `documentOpenRoute()` maps `DATABASE` → `databaseRoute`.
- Databases ride `FolderNode.documents` (type `DATABASE`); reuse the existing document row, dnd id
  (`{ type: "document", docType: "DATABASE" }`), move/delete actions, and a new icon/label/colors in
  `src/lib/client/file-icons.tsx`.
- Add **New database** to the cloud-view "New" dropdown and `CloudToolbar` "New" menu; add
  `createDatabase()` to `LibraryShell` context (mirrors `createBoard`/`createDeck`).
- `createNativeDocument()` in `/api/documents/route.ts` accepts `DATABASE`.

## 5. UX scope (v1)

- **Top bar:** title (rename, `PATCH /api/documents/:id`), save status, and a **view switcher**
  (Table · Board · Calendar) plus a small "＋ add view" for a new view of any type.
- **Table:** sticky header of property names with type menus (rename/retype/delete), an "＋" to add a
  property, rows with inline cell editors per type (text input, number input, select pill dropdown,
  date picker, checkbox), and an "＋ New row" footer.
- **Board:** lane per option of the chosen `select` property + an "Uncategorized" lane; cards show the
  primary cell + a couple of secondary cells; drag-and-drop between lanes via **`@dnd-kit`** (already a
  dependency — see `entities.tsx`); "＋ Add card" per lane; a picker to choose the group property.
- **Calendar:** month grid (prev/next/today), rows as chips on their `date` day, drag a chip to a day
  to reschedule, click a day to add a row, an "Unscheduled" tray; a picker to choose the date property.
- **Empty states:** a friendly hint to add a row / pick a group or date property.
- Autosave: debounced `PATCH /api/databases/:id` on every change; skip while read-only (`VIEWER`).

## 6. Milestones
1. Schema + migration (`DATABASE`, `databaseContent`); `database-schema.ts`; create + GET/PATCH
   endpoints; `databaseRoute`; app route; file-icons + "New" menu wiring.
2. `<DatabaseView />` shell + **Table** view (properties, rows, inline editing, autosave, save status).
3. **Board** view (group-by select, dnd-kit columns, drag to set property, add card).
4. **Calendar** view (month grid, date placement, drag to reschedule, unscheduled tray).
5. Derived-text indexing + multi-view persistence + polish (empty states, type menus).

## 7. Risks & mitigations
| Risk | Mitigation |
|---|---|
| Scope creep into full Notion DB | Hard-cap v1 to 5 property types, no filters/sorts/formulas/relations. |
| Complexity across 3 views | One relational model; views are pure projections of the same rows/cells. |
| Deleting a property leaves dangling cells/view refs | FK `ON DELETE CASCADE` removes cells; API prunes the property from any view config. |
| Calendar/date timezone bugs | `@db.Date` (date-only); convert ⇄ `yyyy-mm-dd` strictly in UTC at the API boundary. |
| EAV write amplification (N cells/row) | Batch cell upserts per row in one txn; reads use a single `include` + in-memory pivot. |
| Large grids re-rendering | Keyed rows, debounced autosave, optimistic local updates; virtualization deferred. |

## 8. Success metrics
- A user can create a database, add typed columns + rows, and flip between Table/Board/Calendar of the
  **same data** without leaving Recall.
- Dragging a Kanban card changes the row's status; dragging a calendar chip changes its date — both
  persist and survive reload.
- Database text appears in library search.

## 9. Open questions
- Shared `canvasContent`-style column vs. dedicated `databaseContent` (leaning dedicated, matching
  `deckContent`/`boardContent`).
- Should the primary column always be `text`, or allow any type as the card/calendar title? (v1: text.)
- CSV import to seed a database from an uploaded `SHEET` (natural fast-follow, not v1).

---

### Appendix — relevant existing code
- `prisma/schema.prisma` — `Document` / `DocumentType` enum; `boardContent`/`deckContent` precedent.
- `src/lib/boards/board-schema.ts` — patch/apply/normalize/deriveText template.
- `src/app/api/boards/[id]/route.ts` — GET/PATCH + reindex template.
- `src/components/whiteboard/board-view.tsx` — debounced autosave + save status template.
- `src/components/cloud/entities.tsx` — existing `@dnd-kit` usage for the Kanban board.
- `src/lib/client/routes.ts`, `src/lib/client/file-icons.tsx`, `src/components/cloud/cloud-toolbar.tsx`,
  `src/components/library/library-shell.tsx` — routing / icons / "New" menu wiring.
