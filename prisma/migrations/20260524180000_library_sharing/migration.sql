-- CreateEnum
CREATE TYPE "LibraryRole" AS ENUM ('EDITOR', 'VIEWER');

-- CreateTable
CREATE TABLE "LibraryMember" (
    "id" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "LibraryRole" NOT NULL DEFAULT 'EDITOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LibraryMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LibraryMember_userId_idx" ON "LibraryMember"("userId");

-- CreateIndex
CREATE INDEX "LibraryMember_libraryId_idx" ON "LibraryMember"("libraryId");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryMember_libraryId_userId_key" ON "LibraryMember"("libraryId", "userId");

-- AddForeignKey
ALTER TABLE "LibraryMember" ADD CONSTRAINT "LibraryMember_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "Library"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryMember" ADD CONSTRAINT "LibraryMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
