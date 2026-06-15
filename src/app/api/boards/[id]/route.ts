import { NextResponse, after, type NextRequest } from "next/server";
import { badRequest, withAuth } from "@/lib/api/http";
import { requireDocument } from "@/lib/documents/document-access";
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

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  return withAuth(ctx, async ({ params, user }) => {
    const board = await requireDocument(user.id, params.id, { type: "WHITEBOARD" });
    return NextResponse.json({
      id: board.id,
      title: board.title,
      folderId: board.folderId,
      libraryId: board.libraryId,
      scene: normalizeBoard(board.boardContent),
      updatedAt: board.updatedAt,
    });
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return withAuth(ctx, async ({ params, user }) => {
    const existing = await requireDocument(user.id, params.id, {
      type: "WHITEBOARD",
      role: "EDITOR",
    });

    const body = (await req.json().catch(() => null)) as {
      patch?: BoardPatch;
      socketId?: string;
    } | null;
    if (!body?.patch) throw badRequest("Missing patch");

    const merged = applyBoardPatch(normalizeBoard(existing.boardContent), body.patch);
    const derivedText = deriveBoardText(merged);

    const updated = await prisma.document.update({
      where: { id: existing.id },
      data: { boardContent: merged, content: derivedText },
      select: { id: true, title: true, updatedAt: true },
    });

    const patch = body.patch;
    const socketId = body.socketId;
    after(async () => {
      try {
        await indexDocument(existing.id, existing.title, derivedText, user.id);
      } catch (error) {
        console.error("[boards] reindex failed", error);
      }
      if (isCollabConfigured()) {
        try {
          await broadcastBoardPatch(existing.id, patch, socketId);
        } catch (error) {
          console.error("[boards] broadcast failed", error);
        }
      }
    });

    return NextResponse.json({ ok: true, updatedAt: updated.updatedAt });
  });
}
