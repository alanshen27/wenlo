import type { LibraryRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getAppUrl, sendLibraryInviteEmail } from "@/lib/email/email";

export type PendingInviteSummary = {
  id: string;
  token: string;
  libraryId: string;
  libraryName: string;
  libraryIcon: string;
  role: LibraryRole;
  message: string | null;
  invitedBy: { name: string | null; email: string };
  createdAt: Date;
};

export async function listPendingInvitesForUser(userId: string, email: string) {
  const invites = await prisma.libraryInvite.findMany({
    where: {
      status: "PENDING",
      OR: [{ userId }, { email: email.toLowerCase() }],
    },
    include: {
      library: { select: { id: true, name: true, icon: true } },
      invitedBy: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return invites.map(
    (invite): PendingInviteSummary => ({
      id: invite.id,
      token: invite.token,
      libraryId: invite.libraryId,
      libraryName: invite.library.name,
      libraryIcon: invite.library.icon,
      role: invite.role,
      message: invite.message,
      invitedBy: invite.invitedBy,
      createdAt: invite.createdAt,
    })
  );
}

export async function acceptLibraryInvite(token: string, userId: string, email: string) {
  const invite = await prisma.libraryInvite.findUnique({
    where: { token },
    include: { library: true },
  });

  if (!invite || invite.status !== "PENDING") {
    throw new Error("Invite not found");
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (invite.email !== normalizedEmail && invite.userId !== userId) {
    throw new Error("This invite was sent to a different email address");
  }

  const member = await prisma.$transaction(async (tx) => {
    const updatedInvite = await tx.libraryInvite.update({
      where: { id: invite.id },
      data: {
        status: "ACCEPTED",
        respondedAt: new Date(),
        userId,
      },
    });

    const libraryMember = await tx.libraryMember.upsert({
      where: { libraryId_userId: { libraryId: invite.libraryId, userId } },
      create: {
        libraryId: invite.libraryId,
        userId,
        role: updatedInvite.role,
      },
      update: { role: updatedInvite.role },
    });

    return libraryMember;
  });

  return { invite, member };
}

export async function declineLibraryInvite(token: string, userId: string, email: string) {
  const invite = await prisma.libraryInvite.findUnique({ where: { token } });
  if (!invite || invite.status !== "PENDING") {
    throw new Error("Invite not found");
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (invite.email !== normalizedEmail && invite.userId !== userId) {
    throw new Error("This invite was sent to a different email address");
  }

  return prisma.libraryInvite.update({
    where: { id: invite.id },
    data: { status: "DECLINED", respondedAt: new Date(), userId },
  });
}

export async function createLibraryInvite(input: {
  libraryId: string;
  email: string;
  role: LibraryRole;
  message?: string | null;
  invitedBy: { id: string; email: string; name: string | null };
  libraryName: string;
}) {
  const normalizedEmail = input.email.trim().toLowerCase();
  const invitee = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  const invite = await prisma.libraryInvite.upsert({
    where: {
      libraryId_email: { libraryId: input.libraryId, email: normalizedEmail },
    },
    create: {
      libraryId: input.libraryId,
      email: normalizedEmail,
      userId: invitee?.id ?? null,
      role: input.role,
      message: input.message?.trim() || null,
      invitedById: input.invitedBy.id,
      status: "PENDING",
      respondedAt: null,
    },
    update: {
      role: input.role,
      message: input.message?.trim() || null,
      invitedById: input.invitedBy.id,
      userId: invitee?.id ?? null,
      status: "PENDING",
      respondedAt: null,
    },
  });

  const inviterName = input.invitedBy.name || input.invitedBy.email;
  const acceptUrl = `${getAppUrl()}/invite/${invite.token}`;

  await sendLibraryInviteEmail({
    to: normalizedEmail,
    libraryName: input.libraryName,
    inviterName,
    inviterEmail: input.invitedBy.email,
    role: input.role,
    message: invite.message,
    acceptUrl,
  });

  return invite;
}
