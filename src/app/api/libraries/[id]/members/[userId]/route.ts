import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/auth";
import { LibraryAccessError, requireLibraryAccess } from "@/lib/library/library-access";
import { prisma } from "@/lib/db/prisma";

type RouteParams = { params: Promise<{ id: string; userId: string }> };

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: libraryId, userId: memberUserId } = await params;

  try {
    await requireLibraryAccess(user.id, libraryId, "OWNER");
  } catch (error) {
    if (error instanceof LibraryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  await prisma.libraryMember.deleteMany({
    where: { libraryId, userId: memberUserId },
  });

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: libraryId, userId: memberUserId } = await params;
  const { role } = await req.json();

  if (role !== "EDITOR" && role !== "VIEWER") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  try {
    await requireLibraryAccess(user.id, libraryId, "OWNER");
  } catch (error) {
    if (error instanceof LibraryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

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
}
