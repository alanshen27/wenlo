import { NextRequest, NextResponse } from "next/server";
import { HttpError, notFound, withAuth, withRoute } from "@/lib/api/http";
import { acceptLibraryInvite, declineLibraryInvite } from "@/lib/library/invites";
import { prisma } from "@/lib/db/prisma";

type RouteParams = { params: Promise<{ token: string }> };

export async function GET(_req: NextRequest, ctx: RouteParams) {
  return withRoute(ctx, async ({ params }) => {
    const invite = await prisma.libraryInvite.findUnique({
      where: { token: params.token },
      include: {
        library: { select: { id: true, name: true, icon: true } },
        invitedBy: { select: { name: true, email: true } },
      },
    });

    if (!invite) throw notFound("Invite not found");

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
  });
}

export async function POST(req: NextRequest, ctx: RouteParams) {
  return withAuth(ctx, async ({ params, user }) => {
    const body = await req.json().catch(() => ({}));
    const action = body.action === "decline" ? "decline" : "accept";

    try {
      if (action === "decline") {
        await declineLibraryInvite(params.token, user.id, user.email);
        return NextResponse.json({ ok: true, status: "DECLINED" });
      }

      const { invite } = await acceptLibraryInvite(params.token, user.id, user.email);
      return NextResponse.json({
        ok: true,
        status: "ACCEPTED",
        libraryId: invite.libraryId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to respond to invite";
      throw new HttpError(message === "Invite not found" ? 404 : 403, message);
    }
  });
}
