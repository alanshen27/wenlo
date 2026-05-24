import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { LibraryAccessError, requireLibraryAccess } from "@/lib/library-access";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string; inviteId: string }> };

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: libraryId, inviteId } = await params;

  try {
    await requireLibraryAccess(user.id, libraryId, "OWNER");
  } catch (error) {
    if (error instanceof LibraryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const invite = await prisma.libraryInvite.findFirst({
    where: { id: inviteId, libraryId, status: "PENDING" },
  });

  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  await prisma.libraryInvite.delete({ where: { id: invite.id } });
  return NextResponse.json({ ok: true });
}
