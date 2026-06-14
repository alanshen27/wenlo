import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/auth";
import { LibraryAccessError, requireLibraryAccess } from "@/lib/library/library-access";
import { prisma } from "@/lib/db/prisma";
import { normalizeDeck } from "@/lib/decks/deck-schema";
import { deckToPptx } from "@/lib/decks/deck-pptx";

/** Server-side .pptx generation, streamed as a download. */
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

  const buffer = await deckToPptx(normalizeDeck(deck.deckContent), deck.title);
  const fileName = `${(deck.title || "deck").replace(/"/g, "")}.pptx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
