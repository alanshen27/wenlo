-- CreateLibrary
CREATE TABLE IF NOT EXISTS "Library" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '📚',
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Library_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Library_userId_idx" ON "Library"("userId");

ALTER TABLE "Library" DROP CONSTRAINT IF EXISTS "Library_userId_fkey";
ALTER TABLE "Library" ADD CONSTRAINT "Library_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add nullable libraryId columns
ALTER TABLE "Folder" ADD COLUMN IF NOT EXISTS "libraryId" TEXT;
ALTER TABLE "Page" ADD COLUMN IF NOT EXISTS "libraryId" TEXT;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "libraryId" TEXT;

-- Default library per user
INSERT INTO "Library" ("id", "name", "icon", "userId", "createdAt", "updatedAt")
SELECT
  'lib_' || u."id",
  'My Library',
  '📚',
  u."id",
  NOW(),
  NOW()
FROM "User" u
WHERE NOT EXISTS (SELECT 1 FROM "Library" l WHERE l."userId" = u."id");

UPDATE "Folder" f
SET "libraryId" = l."id"
FROM "Library" l
WHERE f."userId" = l."userId" AND f."libraryId" IS NULL;

UPDATE "Page" p
SET "libraryId" = l."id"
FROM "Library" l
WHERE p."userId" = l."userId" AND p."libraryId" IS NULL;

UPDATE "Document" d
SET "libraryId" = l."id"
FROM "Library" l
WHERE d."userId" = l."userId" AND d."libraryId" IS NULL;

-- Enforce NOT NULL
ALTER TABLE "Folder" ALTER COLUMN "libraryId" SET NOT NULL;
ALTER TABLE "Page" ALTER COLUMN "libraryId" SET NOT NULL;
ALTER TABLE "Document" ALTER COLUMN "libraryId" SET NOT NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS "Folder_libraryId_idx" ON "Folder"("libraryId");
CREATE INDEX IF NOT EXISTS "Page_libraryId_idx" ON "Page"("libraryId");
CREATE INDEX IF NOT EXISTS "Document_libraryId_idx" ON "Document"("libraryId");

-- Foreign keys
ALTER TABLE "Folder" DROP CONSTRAINT IF EXISTS "Folder_libraryId_fkey";
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_libraryId_fkey"
  FOREIGN KEY ("libraryId") REFERENCES "Library"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Page" DROP CONSTRAINT IF EXISTS "Page_libraryId_fkey";
ALTER TABLE "Page" ADD CONSTRAINT "Page_libraryId_fkey"
  FOREIGN KEY ("libraryId") REFERENCES "Library"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Document" DROP CONSTRAINT IF EXISTS "Document_libraryId_fkey";
ALTER TABLE "Document" ADD CONSTRAINT "Document_libraryId_fkey"
  FOREIGN KEY ("libraryId") REFERENCES "Library"("id") ON DELETE CASCADE ON UPDATE CASCADE;
