import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "@/lib/api/http";
import { requireDocument } from "@/lib/documents/document-access";
import { contentOwnerId } from "@/lib/library/library-access";
import { prisma } from "@/lib/db/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { DOCUMENTS_BUCKET } from "@/lib/documents/storage";
import { pptxToDeck } from "@/lib/decks/pptx-to-deck";
import { deriveDeckText } from "@/lib/decks/deck-schema";
import { indexDocument } from "@/lib/search/search";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  return withAuth(ctx, async ({ params, user }) => {
    const source = await requireDocument(user.id, params.id, { role: "EDITOR" });
    if (!source.storagePath) {
      return NextResponse.json({ error: "No file to convert" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .download(source.storagePath);
    if (error || !data) {
      return NextResponse.json({ error: "Failed to download file" }, { status: 500 });
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    const deckContent = await pptxToDeck(buffer);
    const text = deriveDeckText(deckContent);
    const ownerId = await contentOwnerId(source.libraryId);

    const document = await prisma.document.create({
      data: {
        title: `${source.title.replace(/\.pptx$/i, "")} (editable)`,
        type: "DECK",
        status: "READY",
        content: text,
        deckContent,
        userId: ownerId,
        libraryId: source.libraryId,
        folderId: source.folderId,
      },
    });

    await indexDocument(document.id, document.title, text, user.id).catch(() => {});

    return NextResponse.json(document);
  });
}
