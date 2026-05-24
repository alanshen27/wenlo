import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { acceptLibraryInvite, declineLibraryInvite } from "@/lib/invites";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ token: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { token } = await params;

  const invite = await prisma.libraryInvite.findUnique({
    where: { token },
    include: {
      library: { select: { id: true, name: true, icon: true } },
      invitedBy: { select: { name: true, email: true } },
    },
  });

  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: invite.id,
    token: invite.token,
    status: invite.status,
    role: invite.role,
    message: invite.message,
    email: invite.email,
    library: invite.library,
    invitedBy: invite.invitedBy,
    createdAt: invite.createdAt,
  });
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body.action === "decline" ? "decline" : "accept";

  try {
    if (action === "decline") {
      await declineLibraryInvite(token, user.id, user.email);
      return NextResponse.json({ ok: true, status: "DECLINED" });
    }

    const { invite } = await acceptLibraryInvite(token, user.id, user.email);
    return NextResponse.json({
      ok: true,
      status: "ACCEPTED",
      libraryId: invite.libraryId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to respond to invite";
    const status = message === "Invite not found" ? 404 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}
