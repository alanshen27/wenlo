import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { badRequest, parseBody, withAuth } from "@/lib/api/http";
import { prisma } from "@/lib/db/prisma";
import { requirePage } from "@/lib/pages/page-access";
import { requireDocument } from "@/lib/documents/document-access";

const pinSchema = z
  .object({
    pageId: z.string().optional(),
    documentId: z.string().optional(),
  })
  .refine((d) => Boolean(d.pageId) !== Boolean(d.documentId), {
    message: "Provide exactly one of pageId or documentId",
  });

/** Pin a page or document for the current user (idempotent). */
export async function POST(req: NextRequest) {
  return withAuth(undefined, async ({ user }) => {
    const { pageId, documentId } = await parseBody(req, pinSchema);

    if (pageId) {
      await requirePage(user.id, pageId, "VIEWER");
      await prisma.pin.upsert({
        where: { userId_pageId: { userId: user.id, pageId } },
        create: { userId: user.id, pageId },
        update: {},
      });
    } else if (documentId) {
      await requireDocument(user.id, documentId, { role: "VIEWER" });
      await prisma.pin.upsert({
        where: { userId_documentId: { userId: user.id, documentId } },
        create: { userId: user.id, documentId },
        update: {},
      });
    } else {
      throw badRequest("Provide exactly one of pageId or documentId");
    }

    return NextResponse.json({ pinned: true });
  });
}

/** Remove a pin for the current user. */
export async function DELETE(req: NextRequest) {
  return withAuth(undefined, async ({ user }) => {
    const { pageId, documentId } = await parseBody(req, pinSchema);
    await prisma.pin.deleteMany({
      where: { userId: user.id, ...(pageId ? { pageId } : { documentId }) },
    });
    return NextResponse.json({ pinned: false });
  });
}
