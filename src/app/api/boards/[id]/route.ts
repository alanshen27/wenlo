import { NextRequest, NextResponse, after } from "next/server";
import { requireUser } from "@/lib/auth/auth";
import { LibraryAccessError, requireLibraryAccess } from "@/lib/library/library-access";
import { prisma } from "@/lib/db/prisma";
import { indexDocument } from "@/lib/search/search";
import { isCollabConfigured } from "@/lib/collab/config";
import { broadcastBoardPatch } from "@/lib/realtime/pusher-server";
import {
  applyBoardPatch,
  deriveBoardText,
  normalizeBoard,
  type BoardPatch,
} from "@/lib/boards/board-schema";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const board = await prisma.document.findFirst({ where: { id } });
  if (!board || board.type !== "WHITEBOARD") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await requireLibraryAccess(user.id, board.libraryId, "VIEWER");
  } catch (error) {
    if (error instanceof LibraryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  return NextResponse.json({
    id: board.id,
    title: board.title,
    folderId: board.folderId,
    libraryId: board.libraryId,
    scene: normalizeBoard(board.boardContent),
    updatedAt: board.updatedAt,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    patch?: BoardPatch;
    socketId?: string;
  } | null;

  if (!body?.patch) {
    return NextResponse.json({ error: "Missing patch" }, { status: 400 });
  }

  const existing = await prisma.document.findFirst({ where: { id } });
  if (!existing || existing.type !== "WHITEBOARD") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await requireLibraryAccess(user.id, existing.libraryId, "EDITOR");
  } catch (error) {
    if (error instanceof LibraryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const merged = applyBoardPatch(normalizeBoard(existing.boardContent), body.patch);
  const derivedText = deriveBoardText(merged);

  const updated = await prisma.document.update({
    where: { id },
    data: {
      boardContent: merged,
      content: derivedText,
    },
    select: { id: true, title: true, updatedAt: true },
  });

  after(async () => {
    try {
      await indexDocument(id, existing.title, derivedText, user.id);
    } catch (error) {
      console.error("[boards] reindex failed", error);
    }
    if (isCollabConfigured()) {
      try {
        await broadcastBoardPatch(id, body.patch!, body.socketId);
      } catch (error) {
        console.error("[boards] broadcast failed", error);
      }
    }
  });

  return NextResponse.json({ ok: true, updatedAt: updated.updatedAt });
}
