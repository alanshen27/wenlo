-- AlterTable: track original uploaded file size in bytes
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "sizeBytes" INTEGER;
