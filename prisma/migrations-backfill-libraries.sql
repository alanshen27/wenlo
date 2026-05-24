-- Run after prisma migrate if upgrading existing database

-- Backfill: create a default library per user and assign existing content
INSERT INTO "Library" (id, name, icon, "userId", "createdAt", "updatedAt")
SELECT
  'lib_' || u.id,
  'My Library',
  '📚',
  u.id,
  NOW(),
  NOW()
FROM "User" u
WHERE NOT EXISTS (SELECT 1 FROM "Library" l WHERE l."userId" = u.id);

UPDATE "Folder" f
SET "libraryId" = l.id
FROM "Library" l
WHERE f."userId" = l."userId" AND f."libraryId" IS NULL;

UPDATE "Page" p
SET "libraryId" = l.id
FROM "Library" l
WHERE p."userId" = l."userId" AND p."libraryId" IS NULL;

UPDATE "Document" d
SET "libraryId" = l.id
FROM "Library" l
WHERE d."userId" = l."userId" AND d."libraryId" IS NULL;
