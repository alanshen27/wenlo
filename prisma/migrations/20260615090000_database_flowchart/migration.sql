-- AlterEnum: native editable database + flowchart document types
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'DATABASE';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'FLOWCHART';

-- AlterTable: native scene JSON for flowcharts (node/edge maps; see
-- src/lib/flowcharts/flowchart-schema.ts). Databases are stored relationally
-- (below), not as JSON, so their rows/cells stay queryable in SQL.
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "flowContent" JSONB;

-- Enums for the relational database (Sheet / Kanban / Calendar) model.
DO $$ BEGIN
  CREATE TYPE "DatabasePropertyType" AS ENUM ('TEXT', 'NUMBER', 'SELECT', 'DATE', 'CHECKBOX');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "DatabaseViewType" AS ENUM ('TABLE', 'BOARD', 'CALENDAR');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Columns (properties) of a database.
CREATE TABLE IF NOT EXISTS "DatabaseProperty" (
  "id"         TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "type"       "DatabasePropertyType" NOT NULL DEFAULT 'TEXT',
  "options"    JSONB,
  "position"   INTEGER NOT NULL DEFAULT 0,
  "width"      INTEGER,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DatabaseProperty_pkey" PRIMARY KEY ("id")
);

-- Records (rows) of a database.
CREATE TABLE IF NOT EXISTS "DatabaseRow" (
  "id"         TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "position"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DatabaseRow_pkey" PRIMARY KEY ("id")
);

-- One typed value at (row × property).
CREATE TABLE IF NOT EXISTS "DatabaseCell" (
  "id"            TEXT NOT NULL,
  "rowId"         TEXT NOT NULL,
  "propertyId"    TEXT NOT NULL,
  "valueText"     TEXT,
  "valueNumber"   DOUBLE PRECISION,
  "valueDate"     DATE,
  "valueBool"     BOOLEAN,
  "valueOptionId" TEXT,
  CONSTRAINT "DatabaseCell_pkey" PRIMARY KEY ("id")
);

-- Saved views (Table / Board / Calendar) of a database.
CREATE TABLE IF NOT EXISTS "DatabaseView" (
  "id"         TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "type"       "DatabaseViewType" NOT NULL DEFAULT 'TABLE',
  "config"     JSONB,
  "position"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DatabaseView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DatabaseProperty_documentId_idx" ON "DatabaseProperty"("documentId");
CREATE INDEX IF NOT EXISTS "DatabaseRow_documentId_idx" ON "DatabaseRow"("documentId");
CREATE INDEX IF NOT EXISTS "DatabaseRow_documentId_position_idx" ON "DatabaseRow"("documentId", "position");
CREATE INDEX IF NOT EXISTS "DatabaseCell_rowId_idx" ON "DatabaseCell"("rowId");
CREATE INDEX IF NOT EXISTS "DatabaseCell_propertyId_idx" ON "DatabaseCell"("propertyId");
CREATE INDEX IF NOT EXISTS "DatabaseCell_propertyId_valueOptionId_idx" ON "DatabaseCell"("propertyId", "valueOptionId");
CREATE UNIQUE INDEX IF NOT EXISTS "DatabaseCell_rowId_propertyId_key" ON "DatabaseCell"("rowId", "propertyId");
CREATE INDEX IF NOT EXISTS "DatabaseView_documentId_idx" ON "DatabaseView"("documentId");

ALTER TABLE "DatabaseProperty"
  ADD CONSTRAINT "DatabaseProperty_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DatabaseRow"
  ADD CONSTRAINT "DatabaseRow_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DatabaseCell"
  ADD CONSTRAINT "DatabaseCell_rowId_fkey"
  FOREIGN KEY ("rowId") REFERENCES "DatabaseRow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DatabaseCell"
  ADD CONSTRAINT "DatabaseCell_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "DatabaseProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DatabaseView"
  ADD CONSTRAINT "DatabaseView_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
