import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/auth";
import { createLibraryInvite } from "@/lib/library/invites";
import { LibraryAccessError, requireLibraryAccess } from "@/lib/library/library-access";
import { prisma } from "@/lib/db/prisma";

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

  const [members, pendingInvites] = await Promise.all([
    prisma.libraryMember.findMany({
      where: { libraryId },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.libraryInvite.findMany({
      where: { libraryId, status: "PENDING" },
      include: {
        invitedBy: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

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
    pendingInvites: pendingInvites.map((invite) => ({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      message: invite.message,
      invitedBy: invite.invitedBy,
      createdAt: invite.createdAt,
    })),
    canManage: library.userId === user.id,
  });
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: libraryId } = await params;
  const { email, role, message } = await req.json();

  if (!email?.trim()) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const memberRole = role === "VIEWER" ? "VIEWER" : "EDITOR";
  const customMessage = typeof message === "string" ? message.trim() : undefined;

  try {
    const { library } = await requireLibraryAccess(user.id, libraryId, "OWNER");
    const normalizedEmail = email.trim().toLowerCase();

    const invitee = await prisma.user.findUnique({
      where: { email: normalizedEmail },
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

    const existingMember = await prisma.libraryMember.findUnique({
      where: { libraryId_userId: { libraryId, userId: invitee.id } },
    });
    if (existingMember) {
      return NextResponse.json({ error: "User is already a member" }, { status: 400 });
    }

    const invite = await createLibraryInvite({
      libraryId,
      email: normalizedEmail,
      role: memberRole,
      message: customMessage,
      invitedBy: { id: user.id, email: user.email, name: user.name },
      libraryName: library.name,
    });

    return NextResponse.json({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      message: invite.message,
      status: invite.status,
      createdAt: invite.createdAt,
    });
  } catch (error) {
    if (error instanceof LibraryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
