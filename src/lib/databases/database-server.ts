// Server-only helpers for DATABASE documents: turning the relational rows into
// the client `DatabaseScene`, seeding a new database, and re-deriving the
// searchable text after a mutation. Imports Prisma, so never pull this into a
// client component (use `database-schema.ts` for shared types/helpers).

import { prisma } from "@/lib/db/prisma";
import type { DatabaseTemplateId } from "@/lib/native/database-templates";
import { indexDocument } from "@/lib/search/search";
import {
  columnsToValue,
  deriveDatabaseText,
  newLocalId,
  valueToColumns,
  type CellValue,
  type DatabaseProperty,
  type DatabaseRowData,
  type DatabaseScene,
  type DatabaseView,
  type PropertyType,
  type SelectOption,
  type ViewType,
} from "@/lib/databases/database-schema";

/** Eager-load shape for assembling a full database scene. */
export const databaseInclude = {
  databaseProperties: { orderBy: { position: "asc" as const } },
  databaseViews: { orderBy: { position: "asc" as const } },
  databaseRows: {
    orderBy: { position: "asc" as const },
    include: { cells: true },
  },
};

type CellRecord = {
  propertyId: string;
  valueText: string | null;
  valueNumber: number | null;
  valueDate: Date | null;
  valueBool: boolean | null;
  valueOptionId: string | null;
};

type PropertyRecord = {
  id: string;
  name: string;
  type: PropertyType;
  options: unknown;
  width: number | null;
  position: number;
};

type RowRecord = { id: string; position: number; cells: CellRecord[] };
type ViewRecord = { id: string; name: string; type: ViewType; config: unknown; position: number };

type DocWithDatabase = {
  id: string;
  title: string;
  folderId: string | null;
  libraryId: string;
  databaseProperties: PropertyRecord[];
  databaseRows: RowRecord[];
  databaseViews: ViewRecord[];
};

function parseOptions(json: unknown): SelectOption[] {
  if (!Array.isArray(json)) return [];
  return json
    .filter((o): o is Record<string, unknown> => Boolean(o) && typeof o === "object")
    .map((o) => ({
      id: String(o.id ?? newLocalId()),
      label: String(o.label ?? ""),
      color: String(o.color ?? "gray") as SelectOption["color"],
    }));
}

function parseConfig(json: unknown): DatabaseView["config"] {
  if (!json || typeof json !== "object") return {};
  const c = json as Record<string, unknown>;
  return {
    groupPropertyId: typeof c.groupPropertyId === "string" ? c.groupPropertyId : null,
    datePropertyId: typeof c.datePropertyId === "string" ? c.datePropertyId : null,
  };
}

export function mapProperty(p: PropertyRecord): DatabaseProperty {
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    options: p.type === "SELECT" ? parseOptions(p.options) : [],
    width: p.width,
    position: p.position,
  };
}

export function mapRow(properties: DatabaseProperty[], row: RowRecord): DatabaseRowData {
  const byId = new Map(properties.map((p) => [p.id, p]));
  const cells: Record<string, DatabaseRowData["cells"][string]> = {};
  for (const cell of row.cells) {
    const prop = byId.get(cell.propertyId);
    if (!prop) continue;
    cells[cell.propertyId] = columnsToValue(prop.type, cell);
  }
  return { id: row.id, position: row.position, cells };
}

export function mapView(v: ViewRecord): DatabaseView {
  return {
    id: v.id,
    name: v.name,
    type: v.type,
    position: v.position,
    config: parseConfig(v.config),
  };
}

export function toDatabaseScene(doc: DocWithDatabase): DatabaseScene {
  const properties = doc.databaseProperties.map(mapProperty);
  return {
    id: doc.id,
    title: doc.title,
    folderId: doc.folderId,
    libraryId: doc.libraryId,
    properties,
    rows: doc.databaseRows.map((r) => mapRow(properties, r)),
    views: doc.databaseViews.map(mapView),
  };
}

/**
 * Seed a freshly-created DATABASE document with a starter schema + sample rows.
 */
export async function seedDatabase(
  documentId: string,
  template: string = "tasks"
): Promise<void> {
  const id = (["tasks", "contacts", "roadmap"] as const).includes(
    template as DatabaseTemplateId
  )
    ? (template as DatabaseTemplateId)
    : "tasks";

  if (id === "contacts") return seedContactsDatabase(documentId);
  if (id === "roadmap") return seedRoadmapDatabase(documentId);
  return seedTasksDatabase(documentId);
}

async function seedTasksDatabase(documentId: string): Promise<void> {
  const statusOptions: SelectOption[] = [
    { id: newLocalId(), label: "Todo", color: "gray" },
    { id: newLocalId(), label: "In progress", color: "blue" },
    { id: newLocalId(), label: "Blocked", color: "red" },
    { id: newLocalId(), label: "Done", color: "green" },
  ];

  await prisma.$transaction(async (tx) => {
    const name = await tx.databaseProperty.create({
      data: { documentId, name: "Name", type: "TEXT", position: 0, width: 260 },
    });
    const status = await tx.databaseProperty.create({
      data: { documentId, name: "Status", type: "SELECT", position: 1, options: statusOptions },
    });
    const due = await tx.databaseProperty.create({
      data: { documentId, name: "Due", type: "DATE", position: 2 },
    });

    const seeds = [
      { name: "Polish template thumbnails", status: statusOptions[1].id },
      { name: "Write launch checklist", status: statusOptions[0].id },
      { name: "Billing integration QA", status: statusOptions[0].id },
      { name: "Send beta invites", status: statusOptions[2].id },
    ];
    for (let i = 0; i < seeds.length; i++) {
      const row = await tx.databaseRow.create({ data: { documentId, position: i } });
      await tx.databaseCell.createMany({
        data: [
          { rowId: row.id, propertyId: name.id, valueText: seeds[i].name },
          { rowId: row.id, propertyId: status.id, valueOptionId: seeds[i].status },
        ],
      });
    }

    await tx.databaseView.createMany({
      data: [
        { documentId, name: "All", type: "TABLE", position: 0, config: {} },
        {
          documentId,
          name: "By status",
          type: "BOARD",
          position: 1,
          config: { groupPropertyId: status.id },
        },
        {
          documentId,
          name: "Schedule",
          type: "CALENDAR",
          position: 2,
          config: { datePropertyId: due.id },
        },
      ],
    });
  });
}

async function seedContactsDatabase(documentId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const name = await tx.databaseProperty.create({
      data: { documentId, name: "Name", type: "TEXT", position: 0, width: 200 },
    });
    const email = await tx.databaseProperty.create({
      data: { documentId, name: "Email", type: "TEXT", position: 1, width: 220 },
    });
    const company = await tx.databaseProperty.create({
      data: { documentId, name: "Company", type: "TEXT", position: 2, width: 180 },
    });

    const seeds = [
      { name: "Morgan Chen", email: "morgan@design.co", company: "Studio North" },
      { name: "Priya Patel", email: "priya@acme.io", company: "Acme" },
      { name: "Alex Kim", email: "alex@example.com", company: "Acme" },
    ];
    for (let i = 0; i < seeds.length; i++) {
      const row = await tx.databaseRow.create({ data: { documentId, position: i } });
      await tx.databaseCell.createMany({
        data: [
          { rowId: row.id, propertyId: name.id, valueText: seeds[i].name },
          { rowId: row.id, propertyId: email.id, valueText: seeds[i].email },
          { rowId: row.id, propertyId: company.id, valueText: seeds[i].company },
        ],
      });
    }

    await tx.databaseView.create({
      data: { documentId, name: "All contacts", type: "TABLE", position: 0, config: {} },
    });
  });
}

async function seedRoadmapDatabase(documentId: string): Promise<void> {
  const statusOptions: SelectOption[] = [
    { id: newLocalId(), label: "Planned", color: "gray" },
    { id: newLocalId(), label: "In progress", color: "blue" },
    { id: newLocalId(), label: "Shipped", color: "green" },
  ];
  const quarterOptions: SelectOption[] = [
    { id: newLocalId(), label: "Q1", color: "blue" },
    { id: newLocalId(), label: "Q2", color: "purple" },
    { id: newLocalId(), label: "Q3", color: "orange" },
    { id: newLocalId(), label: "Q4", color: "pink" },
  ];

  await prisma.$transaction(async (tx) => {
    const feature = await tx.databaseProperty.create({
      data: { documentId, name: "Feature", type: "TEXT", position: 0, width: 260 },
    });
    const status = await tx.databaseProperty.create({
      data: { documentId, name: "Status", type: "SELECT", position: 1, options: statusOptions },
    });
    const quarter = await tx.databaseProperty.create({
      data: { documentId, name: "Quarter", type: "SELECT", position: 2, options: quarterOptions },
    });

    const seeds = [
      { feature: "Native app homes", status: statusOptions[2].id, quarter: quarterOptions[0].id },
      { feature: "Template gallery", status: statusOptions[1].id, quarter: quarterOptions[1].id },
      { feature: "Billing v1", status: statusOptions[0].id, quarter: quarterOptions[1].id },
    ];
    for (let i = 0; i < seeds.length; i++) {
      const row = await tx.databaseRow.create({ data: { documentId, position: i } });
      await tx.databaseCell.createMany({
        data: [
          { rowId: row.id, propertyId: feature.id, valueText: seeds[i].feature },
          { rowId: row.id, propertyId: status.id, valueOptionId: seeds[i].status },
          { rowId: row.id, propertyId: quarter.id, valueOptionId: seeds[i].quarter },
        ],
      });
    }

    await tx.databaseView.createMany({
      data: [
        { documentId, name: "All features", type: "TABLE", position: 0, config: {} },
        {
          documentId,
          name: "By status",
          type: "BOARD",
          position: 1,
          config: { groupPropertyId: status.id },
        },
      ],
    });
  });
}

/**
 * Upsert a set of cell values for a row. An empty value clears the cell (the
 * row simply has no cell record for that property). Cells for unknown
 * properties are ignored.
 */
export async function writeRowCells(
  rowId: string,
  cells: Record<string, CellValue>,
  properties: { id: string; type: PropertyType }[]
): Promise<void> {
  const typeById = new Map(properties.map((p) => [p.id, p.type]));
  for (const [propertyId, value] of Object.entries(cells)) {
    const type = typeById.get(propertyId);
    if (!type) continue;
    const cols = valueToColumns(type, value);
    const isEmpty =
      cols.valueText === null &&
      cols.valueNumber === null &&
      cols.valueDate === null &&
      cols.valueBool === null &&
      cols.valueOptionId === null;
    if (isEmpty) {
      await prisma.databaseCell.deleteMany({ where: { rowId, propertyId } });
    } else {
      await prisma.databaseCell.upsert({
        where: { rowId_propertyId: { rowId, propertyId } },
        create: { rowId, propertyId, ...cols },
        update: cols,
      });
    }
  }
}

/** Reload a single row and map it to the client shape. */
export async function loadMappedRow(
  documentId: string,
  rowId: string
): Promise<DatabaseRowData | null> {
  const [props, row] = await Promise.all([
    prisma.databaseProperty.findMany({
      where: { documentId },
      orderBy: { position: "asc" },
    }),
    prisma.databaseRow.findFirst({
      where: { id: rowId, documentId },
      include: { cells: true },
    }),
  ]);
  if (!row) return null;
  return mapRow((props as PropertyRecord[]).map(mapProperty), row as RowRecord);
}

/**
 * Re-derive the database's plain text from its rows and push it through the
 * search index. Call from `after()` on any mutation so search stays fresh.
 */
export async function reindexDatabase(documentId: string, userId: string): Promise<void> {
  const doc = await prisma.document.findFirst({
    where: { id: documentId },
    include: databaseInclude,
  });
  if (!doc || doc.type !== "DATABASE") return;

  const scene = toDatabaseScene(doc as unknown as DocWithDatabase);
  const text = deriveDatabaseText(scene.properties, scene.rows);

  await prisma.document.update({ where: { id: documentId }, data: { content: text } });
  await indexDocument(documentId, doc.title, text, userId);
}
