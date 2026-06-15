import { NextRequest, NextResponse } from "next/server";
import { notFound, withAuth } from "@/lib/api/http";
import { requireLibraryAccess } from "@/lib/library/library-access";
import {
  deleteRecallChatSession,
  getRecallChatSessionForUser,
  getRecallChatTurns,
} from "@/lib/recall-chat/recall-chat";

type RouteParams = { params: Promise<{ id: string; sessionId: string }> };

export async function GET(_req: NextRequest, ctx: RouteParams) {
  return withAuth(ctx, async ({ params, user }) => {
    const { id: libraryId, sessionId } = params;
    await requireLibraryAccess(user.id, libraryId, "VIEWER");

    const session = await getRecallChatSessionForUser(user.id, sessionId);
    if (!session || session.libraryId !== libraryId) throw notFound("Session not found");

    const turns = await getRecallChatTurns(sessionId, user.id);
    return NextResponse.json({
      session: {
        id: session.id,
        title: session.title,
        turnCount: turns.length,
        updatedAt: session.updatedAt.toISOString(),
        createdAt: session.createdAt.toISOString(),
      },
      turns,
    });
  });
}

export async function DELETE(_req: NextRequest, ctx: RouteParams) {
  return withAuth(ctx, async ({ params, user }) => {
    const { id: libraryId, sessionId } = params;
    await requireLibraryAccess(user.id, libraryId, "VIEWER");

    const session = await getRecallChatSessionForUser(user.id, sessionId);
    if (!session || session.libraryId !== libraryId) throw notFound("Session not found");

    await deleteRecallChatSession(user.id, sessionId);
    return NextResponse.json({ ok: true });
  });
}
