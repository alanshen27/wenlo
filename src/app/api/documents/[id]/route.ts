import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { parseBody, withAuth } from "@/lib/api/http";
import { requireDocument } from "@/lib/documents/document-access";
import { prisma } from "@/lib/db/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  title: z.string().optional(),
  folderId: z.string().nullable().optional(),
});

export async function GET(_req: NextRequest, ctx: Ctx) {
  return withAuth(ctx, async ({ params, user }) => {
    const document = await requireDocument(user.id, params.id);
    return NextResponse.json(document);
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return withAuth(ctx, async ({ params, user }) => {
    const document = await requireDocument(user.id, params.id, { role: "EDITOR" });

    if (document.storagePath) {
      try {
        const supabase = createAdminClient();
        await supabase.storage.from("documents").remove([document.storagePath]);
      } catch {
        // ignore storage cleanup failures
      }
    }

    await prisma.document.delete({ where: { id: document.id } });
    return NextResponse.json({ ok: true });
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return withAuth(ctx, async ({ params, user }) => {
    const existing = await requireDocument(user.id, params.id, { role: "EDITOR" });
    const { title, folderId } = await parseBody(req, patchSchema);

    const document = await prisma.document.update({
      where: { id: existing.id },
      data: {
        ...(title !== undefined && { title: title.trim() || existing.title }),
        ...(folderId !== undefined && {
          folderId: folderId && folderId !== "__root__" ? folderId : null,
        }),
      },
    });

    return NextResponse.json(document);
  });
}
