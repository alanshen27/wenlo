-- Recall chat sessions (per user, library, and search scope)
CREATE TABLE "RecallChatSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "turns" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecallChatSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecallChatSession_userId_libraryId_scopeKey_key" ON "RecallChatSession"("userId", "libraryId", "scopeKey");
CREATE INDEX "RecallChatSession_libraryId_idx" ON "RecallChatSession"("libraryId");

ALTER TABLE "RecallChatSession" ADD CONSTRAINT "RecallChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecallChatSession" ADD CONSTRAINT "RecallChatSession_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "Library"("id") ON DELETE CASCADE ON UPDATE CASCADE;
