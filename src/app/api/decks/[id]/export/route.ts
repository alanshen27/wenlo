import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/http";
import { requireDocument } from "@/lib/documents/document-access";
import { normalizeDeck } from "@/lib/decks/deck-schema";
import { deckToPptx } from "@/lib/decks/deck-pptx";

/** Server-side .pptx generation, streamed as a download. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(ctx, async ({ params, user }) => {
    const deck = await requireDocument(user.id, params.id, { type: "DECK" });

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
  });
}
