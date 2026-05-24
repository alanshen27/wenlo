-- CreateTable
CREATE TABLE "PagePresence" (
    "pageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "lastSeen" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PagePresence_pkey" PRIMARY KEY ("pageId","userId")
);

-- CreateIndex
CREATE INDEX "PagePresence_pageId_idx" ON "PagePresence"("pageId");

-- AddForeignKey
ALTER TABLE "PagePresence" ADD CONSTRAINT "PagePresence_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagePresence" ADD CONSTRAINT "PagePresence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
