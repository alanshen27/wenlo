-- CreateEnum
CREATE TYPE "ShareAccess" AS ENUM ('NONE', 'VIEW', 'EDIT');

-- AlterTable
ALTER TABLE "Folder" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Page" ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "shareToken" TEXT,
ADD COLUMN "shareAccess" "ShareAccess" NOT NULL DEFAULT 'NONE',
ADD COLUMN "sharePasswordHash" TEXT;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "shareToken" TEXT,
ADD COLUMN "shareAccess" "ShareAccess" NOT NULL DEFAULT 'NONE',
ADD COLUMN "sharePasswordHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Page_shareToken_key" ON "Page"("shareToken");

-- CreateIndex
CREATE UNIQUE INDEX "Document_shareToken_key" ON "Document"("shareToken");

-- CreateIndex
CREATE INDEX "Folder_libraryId_deletedAt_idx" ON "Folder"("libraryId", "deletedAt");

-- CreateIndex
CREATE INDEX "Page_libraryId_deletedAt_idx" ON "Page"("libraryId", "deletedAt");

-- CreateIndex
CREATE INDEX "Document_libraryId_deletedAt_idx" ON "Document"("libraryId", "deletedAt");

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_read_createdAt_idx" ON "Notification"("userId", "read", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
