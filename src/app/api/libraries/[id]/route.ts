import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { badRequest, parseBody, withAuth } from "@/lib/api/http";
import { requireLibraryAccess } from "@/lib/library/library-access";
import { prisma } from "@/lib/db/prisma";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().optional(),
  icon: z.string().optional(),
});

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return withAuth(ctx, async ({ params, user }) => {
    await requireLibraryAccess(user.id, params.id, "OWNER");
    const { name, icon } = await parseBody(req, patchSchema);

    const library = await prisma.library.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(icon !== undefined && { icon }),
      },
    });

    return NextResponse.json(library);
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return withAuth(ctx, async ({ params, user }) => {
    await requireLibraryAccess(user.id, params.id, "OWNER");

    const ownedCount = await prisma.library.count({ where: { userId: user.id } });
    if (ownedCount <= 1) throw badRequest("Cannot delete your only library");

    await prisma.library.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  });
}
