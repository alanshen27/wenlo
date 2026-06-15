// Client-safe types + helpers for the relational database (Sheet / Kanban /
// Calendar). The actual data lives in Prisma tables (DatabaseProperty /
// DatabaseRow / DatabaseCell / DatabaseView); this module defines the shared
// TS shapes the API assembles rows into, the cell value <-> typed-column codec,
// date helpers, select-option colors, and the search-text derivation.
//
// Keep this file free of any `@/generated/prisma` *value* imports so it can be
// imported from client components. Server-only assembly/seeding lives in
// `database-server.ts`.

export type PropertyType = "TEXT" | "NUMBER" | "SELECT" | "DATE" | "CHECKBOX";
export type ViewType = "TABLE" | "BOARD" | "CALENDAR";

export type SelectOption = { id: string; label: string; color: SelectColor };

export type DatabaseProperty = {
  id: string;
  name: string;
  type: PropertyType;
  /** Choices for SELECT properties; empty for every other type. */
  options: SelectOption[];
  width?: number | null;
  position: number;
};

/**
 * A cell value, keyed by property in a row. Encodings:
 *  TEXT -> string · NUMBER -> number · SELECT -> optionId (string)
 *  DATE -> "yyyy-mm-dd" · CHECKBOX -> boolean. `null`/"" means empty.
 */
export type CellValue = string | number | boolean | null;

export type DatabaseRowData = {
  id: string;
  position: number;
  cells: Record<string, CellValue>;
};

export type ViewConfig = {
  /** BOARD: the SELECT property whose options become lanes. */
  groupPropertyId?: string | null;
  /** CALENDAR: the DATE property rows are placed on. */
  datePropertyId?: string | null;
};

export type DatabaseView = {
  id: string;
  name: string;
  type: ViewType;
  position: number;
  config: ViewConfig;
};

export type DatabaseScene = {
  id: string;
  title: string;
  folderId: string | null;
  libraryId: string;
  properties: DatabaseProperty[];
  rows: DatabaseRowData[];
  views: DatabaseView[];
};

// ---------------------------------------------------------------------------
// Select option colors
// ---------------------------------------------------------------------------

export const SELECT_COLORS = [
  "gray",
  "blue",
  "green",
  "yellow",
  "orange",
  "red",
  "purple",
  "pink",
] as const;

export type SelectColor = (typeof SELECT_COLORS)[number];

/** Pill classes (bg + text) for a select option color, light + dark. */
export function selectColorClasses(color: string): string {
  switch (color) {
    case "blue":
      return "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300";
    case "green":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300";
    case "yellow":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300";
    case "orange":
      return "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300";
    case "red":
      return "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300";
    case "purple":
      return "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300";
    case "pink":
      return "bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300";
    case "gray":
    default:
      return "bg-zinc-100 text-zinc-700 dark:bg-zinc-700/50 dark:text-zinc-300";
  }
}

// ---------------------------------------------------------------------------
// Date helpers — date-only, always handled in UTC to avoid timezone drift.
// ---------------------------------------------------------------------------

/** A JS `Date` (from `@db.Date`) -> "yyyy-mm-dd" using UTC parts. */
export function dateToIso(d: Date | null | undefined): string | null {
  if (!d) return null;
  const t = d.getTime();
  if (Number.isNaN(t)) return null;
  return d.toISOString().slice(0, 10);
}

/** "yyyy-mm-dd" -> a UTC-midnight `Date` suitable for a `@db.Date` column. */
export function isoToDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const d = new Date(`${iso}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// Cell value <-> typed column codec
// ---------------------------------------------------------------------------

export type CellColumns = {
  valueText: string | null;
  valueNumber: number | null;
  valueDate: Date | null;
  valueBool: boolean | null;
  valueOptionId: string | null;
};

export function emptyCellColumns(): CellColumns {
  return {
    valueText: null,
    valueNumber: null,
    valueDate: null,
    valueBool: null,
    valueOptionId: null,
  };
}

/** Encode a logical cell value into the one typed column its property uses. */
export function valueToColumns(type: PropertyType, value: CellValue): CellColumns {
  const cols = emptyCellColumns();
  if (value === null || value === undefined || value === "") return cols;

  switch (type) {
    case "TEXT":
      cols.valueText = String(value);
      break;
    case "NUMBER": {
      const n = typeof value === "number" ? value : Number(value);
      cols.valueNumber = Number.isFinite(n) ? n : null;
      break;
    }
    case "SELECT":
      cols.valueOptionId = String(value);
      break;
    case "DATE":
      cols.valueDate = isoToDate(String(value));
      break;
    case "CHECKBOX":
      cols.valueBool = Boolean(value);
      break;
  }
  return cols;
}

/** Decode the populated typed column back into a logical cell value. */
export function columnsToValue(type: PropertyType, cell: Partial<CellColumns>): CellValue {
  switch (type) {
    case "TEXT":
      return cell.valueText ?? null;
    case "NUMBER":
      return cell.valueNumber ?? null;
    case "SELECT":
      return cell.valueOptionId ?? null;
    case "DATE":
      return dateToIso(cell.valueDate ?? null);
    case "CHECKBOX":
      return cell.valueBool ?? null;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Display + search
// ---------------------------------------------------------------------------

/** Human-readable text for a single cell (resolves select options to labels). */
export function formatCellText(prop: DatabaseProperty, value: CellValue): string {
  if (value === null || value === undefined || value === "") return "";
  switch (prop.type) {
    case "SELECT": {
      const opt = prop.options.find((o) => o.id === value);
      return opt ? opt.label : "";
    }
    case "CHECKBOX":
      return value ? prop.name : "";
    case "DATE":
      return String(value);
    default:
      return String(value);
  }
}

/** Concatenated cell text across all rows, for the search index. */
export function deriveDatabaseText(
  properties: DatabaseProperty[],
  rows: DatabaseRowData[]
): string {
  const parts: string[] = [];
  for (const row of rows) {
    const rowParts: string[] = [];
    for (const prop of properties) {
      const text = formatCellText(prop, row.cells[prop.id] ?? null);
      if (text) rowParts.push(text);
    }
    if (rowParts.length) parts.push(rowParts.join(" · "));
  }
  return parts.join("\n");
}

/** The primary (title) property is the first column. */
export function primaryProperty(properties: DatabaseProperty[]): DatabaseProperty | null {
  return properties[0] ?? null;
}

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  TEXT: "Text",
  NUMBER: "Number",
  SELECT: "Select",
  DATE: "Date",
  CHECKBOX: "Checkbox",
};

export const VIEW_TYPE_LABELS: Record<ViewType, string> = {
  TABLE: "Table",
  BOARD: "Board",
  CALENDAR: "Calendar",
};

/** Crypto-random id for client-side optimistic options/temp rows. */
export function newLocalId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `tmp-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}
