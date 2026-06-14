-- AlterEnum: native editable slideshow (deck) document type
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'DECK';

-- AlterTable: native slideshow scene JSON for decks (flat slide/element maps,
-- collaboration-friendly; see src/lib/decks/deck-schema.ts).
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "deckContent" JSONB;
