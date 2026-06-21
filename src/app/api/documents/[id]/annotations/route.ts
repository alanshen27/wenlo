import { NextResponse, type NextRequest } from "next/server";
import { badRequest, withAuth } from "@/lib/api/http";
import { requireDocument } from "@/lib/documents/document-access";
import { prisma } from "@/lib/db/prisma";
import {
  applyPdfAnnotationPatch,
  normalizePdfAnnotations,
  type PdfAnnotationPatch,
} from "@/lib/pdfs/pdf-annotation-schema";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  return withAuth(ctx, async ({ params, user }) => {
    const document = await requireDocument(user.id, params.id);
    if (document.mimeType !== "application/pdf") {
      return NextResponse.json(normalizePdfAnnotations(null));
    }
    return NextResponse.json(normalizePdfAnnotations(document.pdfAnnotations));
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return withAuth(ctx, async ({ params, user }) => {
    const existing = await requireDocument(user.id, params.id, { role: "EDITOR" });
    if (existing.mimeType !== "application/pdf") throw badRequest("Not a PDF document");

    const body = (await req.json().catch(() => null)) as { patch?: PdfAnnotationPatch } | null;
    if (!body?.patch) throw badRequest("Missing patch");

    const merged = applyPdfAnnotationPatch(
      normalizePdfAnnotations(existing.pdfAnnotations),
      body.patch
    );

    const updated = await prisma.document.update({
      where: { id: existing.id },
      data: { pdfAnnotations: merged },
      select: { id: true, updatedAt: true },
    });

    return NextResponse.json({ ok: true, updatedAt: updated.updatedAt });
  });
}
