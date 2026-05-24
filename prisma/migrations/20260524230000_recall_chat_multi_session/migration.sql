-- Allow multiple recall chat sessions per scope; add optional titles
DROP INDEX IF EXISTS "RecallChatSession_userId_libraryId_scopeKey_key";

ALTER TABLE "RecallChatSession" ADD COLUMN IF NOT EXISTS "title" TEXT;

CREATE INDEX IF NOT EXISTS "RecallChatSession_userId_libraryId_scopeKey_updatedAt_idx"
  ON "RecallChatSession"("userId", "libraryId", "scopeKey", "updatedAt" DESC);
