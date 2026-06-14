import { NextRequest, NextResponse, after } from "next/server";
import { requireUser } from "@/lib/auth/auth";
import { LibraryAccessError, requireLibraryAccess } from "@/lib/library/library-access";
import { prisma } from "@/lib/db/prisma";
import { indexDocument } from "@/lib/search/search";
import { deriveDeckText, normalizeDeck } from "@/lib/decks/deck-schema";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const deck = await prisma.document.findFirst({ where: { id } });
  if (!deck || deck.type !== "DECK") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await requireLibraryAccess(user.id, deck.libraryId, "VIEWER");
  } catch (error) {
    if (error instanceof LibraryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  return NextResponse.json({
    id: deck.id,
    title: deck.title,
    folderId: deck.folderId,
    libraryId: deck.libraryId,
    deck: normalizeDeck(deck.deckContent),
    updatedAt: deck.updatedAt,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { deck?: unknown } | null;
  if (!body || body.deck === undefined) {
    return NextResponse.json({ error: "Missing deck" }, { status: 400 });
  }

  const existing = await prisma.document.findFirst({ where: { id } });
  if (!existing || existing.type !== "DECK") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await requireLibraryAccess(user.id, existing.libraryId, "EDITOR");
  } catch (error) {
    if (error instanceof LibraryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const deck = normalizeDeck(body.deck);
  const derivedText = deriveDeckText(deck);

  const updated = await prisma.document.update({
    where: { id },
    data: { deckContent: deck, content: derivedText },
    select: { id: true, updatedAt: true },
  });

  after(async () => {
    try {
      await indexDocument(id, existing.title, derivedText, user.id);
    } catch (error) {
      console.error("[decks] reindex failed", error);
    }
  });

  return NextResponse.json({ ok: true, updatedAt: updated.updatedAt });
}
