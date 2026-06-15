import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { notFound, parseBody, withAuth } from "@/lib/api/http";
import { requireLibraryAccess } from "@/lib/library/library-access";
import { prisma } from "@/lib/db/prisma";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().optional(),
  parentId: z.string().nullish(),
  color: z.string().optional(),
});

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return withAuth(ctx, async ({ params, user }) => {
    const folder = await prisma.folder.findFirst({ where: { id: params.id } });
    if (!folder) throw notFound();
    await requireLibraryAccess(user.id, folder.libraryId, "EDITOR");

    const { name, parentId, color } = await parseBody(req, patchSchema);
    const updated = await prisma.folder.update({
      where: { id: folder.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(color !== undefined && { color }),
        ...(parentId !== undefined && { parentId: parentId || null }),
      },
    });

    return NextResponse.json(updated);
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return withAuth(ctx, async ({ params, user }) => {
    const folder = await prisma.folder.findFirst({ where: { id: params.id } });
    if (!folder) throw notFound();
    await requireLibraryAccess(user.id, folder.libraryId, "EDITOR");

    await prisma.folder.delete({ where: { id: folder.id } });
    return NextResponse.json({ ok: true });
  });
}
