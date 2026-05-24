-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateTable
CREATE TABLE "LibraryInvite" (
    "id" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "role" "LibraryRole" NOT NULL DEFAULT 'EDITOR',
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "token" TEXT NOT NULL,
    "message" TEXT,
    "invitedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "LibraryInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LibraryInvite_token_key" ON "LibraryInvite"("token");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryInvite_libraryId_email_key" ON "LibraryInvite"("libraryId", "email");

-- CreateIndex
CREATE INDEX "LibraryInvite_userId_status_idx" ON "LibraryInvite"("userId", "status");

-- CreateIndex
CREATE INDEX "LibraryInvite_email_status_idx" ON "LibraryInvite"("email", "status");

-- CreateIndex
CREATE INDEX "LibraryInvite_libraryId_status_idx" ON "LibraryInvite"("libraryId", "status");

-- AddForeignKey
ALTER TABLE "LibraryInvite" ADD CONSTRAINT "LibraryInvite_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "Library"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryInvite" ADD CONSTRAINT "LibraryInvite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryInvite" ADD CONSTRAINT "LibraryInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
