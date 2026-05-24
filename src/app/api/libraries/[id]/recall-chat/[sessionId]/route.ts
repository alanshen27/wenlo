import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { LibraryAccessError, requireLibraryAccess } from "@/lib/library-access";
import {
  deleteRecallChatSession,
  getRecallChatSessionForUser,
  getRecallChatTurns,
} from "@/lib/recall-chat";

type RouteParams = { params: Promise<{ id: string; sessionId: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: libraryId, sessionId } = await params;

  try {
    await requireLibraryAccess(user.id, libraryId, "VIEWER");
  } catch (error) {
    if (error instanceof LibraryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const session = await getRecallChatSessionForUser(user.id, sessionId);
  if (!session || session.libraryId !== libraryId) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

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
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: libraryId, sessionId } = await params;

  try {
    await requireLibraryAccess(user.id, libraryId, "VIEWER");
  } catch (error) {
    if (error instanceof LibraryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const session = await getRecallChatSessionForUser(user.id, sessionId);
  if (!session || session.libraryId !== libraryId) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  await deleteRecallChatSession(user.id, sessionId);
  return NextResponse.json({ ok: true });
}
