import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseBody } from "@/lib/api/http";
import { resolveShareByToken, verifySharePassword } from "@/lib/share/share";

const accessSchema = z.object({
  token: z.string(),
  password: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const { token, password } = await parseBody(req, accessSchema);
  const resolved = await resolveShareByToken(token);
  if (!resolved) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (resolved.item.sharePasswordHash) {
    if (!password || !verifySharePassword(password, resolved.item.sharePasswordHash)) {
      return NextResponse.json({ error: "Invalid password" }, { status: 403 });
    }
  }

  if (resolved.type === "page") {
    const page = resolved.item;
    return NextResponse.json({
      type: "page",
      id: page.id,
      title: page.title,
      content: page.content,
      access: page.shareAccess,
      libraryId: page.libraryId,
    });
  }

  const doc = resolved.item;
  return NextResponse.json({
    type: "document",
    id: doc.id,
    title: doc.title,
    documentType: doc.type,
    content: doc.content,
    deckContent: doc.deckContent,
    boardContent: doc.boardContent,
    flowContent: doc.flowContent,
    access: doc.shareAccess,
    libraryId: doc.libraryId,
    mimeType: doc.mimeType,
    storagePath: doc.storagePath,
  });
}
