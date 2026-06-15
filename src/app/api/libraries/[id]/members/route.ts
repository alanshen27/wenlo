import { NextRequest, NextResponse } from "next/server";
import { badRequest, notFound, withAuth } from "@/lib/api/http";
import { createLibraryInvite } from "@/lib/library/invites";
import { requireLibraryAccess } from "@/lib/library/library-access";
import { prisma } from "@/lib/db/prisma";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteParams) {
  return withAuth(ctx, async ({ params, user }) => {
    const libraryId = params.id;
    await requireLibraryAccess(user.id, libraryId, "VIEWER");

    const library = await prisma.library.findUniqueOrThrow({
    where: { id: libraryId },
    select: { id: true, name: true, userId: true },
  });

  const [members, pendingInvites] = await Promise.all([
    prisma.libraryMember.findMany({
      where: { libraryId },
      include: {
        user: { select: { id: true, email: true, name: true, avatarUrl: true } },
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
    select: { id: true, email: true, name: true, avatarUrl: true },
  });

  return NextResponse.json({
    owner,
    currentUserId: user.id,
    members: members.map((m) => ({
      id: m.id,
      userId: m.userId,
      email: m.user.email,
      name: m.user.name,
      avatarUrl: m.user.avatarUrl,
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
  });
}

export async function POST(req: NextRequest, ctx: RouteParams) {
  return withAuth(ctx, async ({ params, user }) => {
    const libraryId = params.id;
    const { email, role, message } = await req.json();

    if (!email?.trim()) throw badRequest("Email required");

    const memberRole = role === "VIEWER" ? "VIEWER" : "EDITOR";
    const customMessage = typeof message === "string" ? message.trim() : undefined;

    const { library } = await requireLibraryAccess(user.id, libraryId, "OWNER");
    const normalizedEmail = email.trim().toLowerCase();

    const invitee = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!invitee) {
      throw notFound("No account found with that email. They need to sign up first.");
    }

    if (invitee.id === library.userId) {
      throw badRequest("Owner already has access");
    }

    const existingMember = await prisma.libraryMember.findUnique({
      where: { libraryId_userId: { libraryId, userId: invitee.id } },
    });
    if (existingMember) {
      throw badRequest("User is already a member");
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
  });
}
