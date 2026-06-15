import { NextRequest, NextResponse } from "next/server";
import { notFound, withAuth } from "@/lib/api/http";
import { requireLibraryAccess } from "@/lib/library/library-access";
import { prisma } from "@/lib/db/prisma";

type RouteParams = { params: Promise<{ id: string; inviteId: string }> };

export async function DELETE(_req: NextRequest, ctx: RouteParams) {
  return withAuth(ctx, async ({ params, user }) => {
    const { id: libraryId, inviteId } = params;
    await requireLibraryAccess(user.id, libraryId, "OWNER");

    const invite = await prisma.libraryInvite.findFirst({
      where: { id: inviteId, libraryId, status: "PENDING" },
    });

    if (!invite) throw notFound("Invite not found");

    await prisma.libraryInvite.delete({ where: { id: invite.id } });
    return NextResponse.json({ ok: true });
  });
}
