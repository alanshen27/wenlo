-- AlterEnum: native editable whiteboard document type
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'WHITEBOARD';

-- AlterTable: native canvas scene JSON for whiteboards (per-element edit locks
-- are ephemeral and live in Redis, not in Postgres).
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "boardContent" JSONB;
