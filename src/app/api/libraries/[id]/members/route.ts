import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { LibraryAccessError, requireLibraryAccess } from "@/lib/library-access";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: libraryId } = await params;

  try {
    await requireLibraryAccess(user.id, libraryId, "VIEWER");
  } catch (error) {
    if (error instanceof LibraryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const library = await prisma.library.findUniqueOrThrow({
    where: { id: libraryId },
    select: { id: true, name: true, userId: true },
  });

  const members = await prisma.libraryMember.findMany({
    where: { libraryId },
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const owner = await prisma.user.findUniqueOrThrow({
    where: { id: library.userId },
    select: { id: true, email: true, name: true },
  });

  return NextResponse.json({
    owner,
    members: members.map((m) => ({
      id: m.id,
      userId: m.userId,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
      createdAt: m.createdAt,
    })),
    canManage: library.userId === user.id,
  });
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: libraryId } = await params;
  const { email, role } = await req.json();

  if (!email?.trim()) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const memberRole = role === "VIEWER" ? "VIEWER" : "EDITOR";

  try {
    const { library } = await requireLibraryAccess(user.id, libraryId, "OWNER");
    const invitee = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!invitee) {
      return NextResponse.json(
        { error: "No account found with that email. They need to sign up first." },
        { status: 404 }
      );
    }

    if (invitee.id === library.userId) {
      return NextResponse.json({ error: "Owner already has access" }, { status: 400 });
    }

    const member = await prisma.libraryMember.upsert({
      where: { libraryId_userId: { libraryId, userId: invitee.id } },
      create: { libraryId, userId: invitee.id, role: memberRole },
      update: { role: memberRole },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });

    return NextResponse.json({
      id: member.id,
      userId: member.userId,
      email: member.user.email,
      name: member.user.name,
      role: member.role,
      createdAt: member.createdAt,
    });
  } catch (error) {
    if (error instanceof LibraryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
