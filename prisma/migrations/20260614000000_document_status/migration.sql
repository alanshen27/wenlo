-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DocumentStatus') THEN
    CREATE TYPE "DocumentStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED');
  END IF;
END
$$;

-- AlterTable
ALTER TABLE "Document"
  ADD COLUMN IF NOT EXISTS "status" "DocumentStatus" NOT NULL DEFAULT 'READY';
