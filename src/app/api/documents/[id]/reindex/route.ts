import { NextRequest, NextResponse, after } from "next/server";
import { withAuth } from "@/lib/api/http";
import { requireDocument } from "@/lib/documents/document-access";
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
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(ctx, async ({ params, user }) => {
    const document = await requireDocument(user.id, params.id, { role: "EDITOR" });
    const { id } = document;

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
  });
}
