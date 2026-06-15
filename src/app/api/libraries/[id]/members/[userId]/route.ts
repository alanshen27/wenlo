import { NextRequest, NextResponse } from "next/server";
import { badRequest, withAuth } from "@/lib/api/http";
import { requireLibraryAccess } from "@/lib/library/library-access";
import { prisma } from "@/lib/db/prisma";

type RouteParams = { params: Promise<{ id: string; userId: string }> };

export async function DELETE(_req: NextRequest, ctx: RouteParams) {
  return withAuth(ctx, async ({ params, user }) => {
    const { id: libraryId, userId: memberUserId } = params;
    await requireLibraryAccess(user.id, libraryId, "OWNER");

    await prisma.libraryMember.deleteMany({
      where: { libraryId, userId: memberUserId },
    });

    return NextResponse.json({ ok: true });
  });
}

export async function PATCH(req: NextRequest, ctx: RouteParams) {
  return withAuth(ctx, async ({ params, user }) => {
    const { id: libraryId, userId: memberUserId } = params;
    const { role } = await req.json();

    if (role !== "EDITOR" && role !== "VIEWER") throw badRequest("Invalid role");

    await requireLibraryAccess(user.id, libraryId, "OWNER");

    const member = await prisma.libraryMember.update({
      where: { libraryId_userId: { libraryId, userId: memberUserId } },
      data: { role },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    return NextResponse.json({
      id: member.id,
      userId: member.userId,
      email: member.user.email,
      name: member.user.name,
      role: member.role,
      createdAt: member.createdAt,
    });
  });
}
