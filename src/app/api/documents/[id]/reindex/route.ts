import { NextRequest, NextResponse, after } from "next/server";
import { requireUser } from "@/lib/auth/auth";
import { LibraryAccessError, requireLibraryAccess } from "@/lib/library/library-access";
import { prisma } from "@/lib/db/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { DOCUMENTS_BUCKET } from "@/lib/documents/storage";
import {
  extractTextFromFile,
  extractWithOpenAI,
  sanitizeText,
} from "@/lib/documents/extract";
import { hasOpenAI, OPENAI_FILE_PROCESSING_ENABLED } from "@/lib/search/openai";
import { indexDocument } from "@/lib/search/search";

/**
 * Re-runs extraction + embedding for a document. When the original file is
 * still in storage we re-extract it (native parse + an OpenAI vision/file pass)
 * so improved extraction logic or a previously failed AI pass takes effect.
 * Falls back to the document's existing content when no file is stored.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const document = await prisma.document.findFirst({ where: { id } });
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await requireLibraryAccess(user.id, document.libraryId, "EDITOR");
  } catch (error) {
    if (error instanceof LibraryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  await prisma.document.update({ where: { id }, data: { status: "PROCESSING" } });

  after(async () => {
    try {
      let content = document.content;

      if (document.storagePath) {
        const supabase = createAdminClient();
        const { data } = await supabase.storage
          .from(DOCUMENTS_BUCKET)
          .download(document.storagePath);

        if (data) {
          const buffer = Buffer.from(await data.arrayBuffer());
          const mimeType = document.mimeType || "application/octet-stream";
          const native = await extractTextFromFile(buffer, mimeType, document.title);
          let extracted = native.content;

          if (OPENAI_FILE_PROCESSING_ENABLED && hasOpenAI()) {
            const aiText = sanitizeText(
              await extractWithOpenAI(buffer, mimeType, document.title, user.id).catch(() => "")
            ).trim();
            if (aiText) {
              extracted =
                native.aiEligible || !native.content.trim()
                  ? aiText
                  : `${native.content}\n\n${aiText}`;
            }
          }

          if (extracted.trim()) {
            content = extracted;
            await prisma.document.update({ where: { id }, data: { content } });
          }
        }
      }

      await indexDocument(document.id, document.title, content, user.id);
      await prisma.document.update({ where: { id }, data: { status: "READY" } });
    } catch {
      await prisma.document
        .update({ where: { id }, data: { status: "FAILED" } })
        .catch(() => {});
    }
  });

  return NextResponse.json({ id: document.id, status: "PROCESSING" });
}
