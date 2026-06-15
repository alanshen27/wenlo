import { NextResponse, after, type NextRequest } from "next/server";
import { badRequest, withAuth } from "@/lib/api/http";
import { requireDocument } from "@/lib/documents/document-access";
import { prisma } from "@/lib/db/prisma";
import { indexDocument } from "@/lib/search/search";
import { deriveDeckText, normalizeDeck } from "@/lib/decks/deck-schema";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  return withAuth(ctx, async ({ params, user }) => {
    const deck = await requireDocument(user.id, params.id, { type: "DECK" });
    return NextResponse.json({
      id: deck.id,
      title: deck.title,
      folderId: deck.folderId,
      libraryId: deck.libraryId,
      deck: normalizeDeck(deck.deckContent),
      updatedAt: deck.updatedAt,
    });
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return withAuth(ctx, async ({ params, user }) => {
    const existing = await requireDocument(user.id, params.id, { type: "DECK", role: "EDITOR" });

    const body = (await req.json().catch(() => null)) as { deck?: unknown } | null;
    if (!body || body.deck === undefined) throw badRequest("Missing deck");

    const deck = normalizeDeck(body.deck);
    const derivedText = deriveDeckText(deck);

    const updated = await prisma.document.update({
      where: { id: existing.id },
      data: { deckContent: deck, content: derivedText },
      select: { id: true, updatedAt: true },
    });

    after(async () => {
      try {
        await indexDocument(existing.id, existing.title, derivedText, user.id);
      } catch (error) {
        console.error("[decks] reindex failed", error);
      }
    });

    return NextResponse.json({ ok: true, updatedAt: updated.updatedAt });
  });
}
