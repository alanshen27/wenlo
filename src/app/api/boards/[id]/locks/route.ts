import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/auth";
import { LibraryAccessError, requireLibraryAccess } from "@/lib/library/library-access";
import { prisma } from "@/lib/db/prisma";
import { isCollabConfigured } from "@/lib/collab/config";
import { colorForUser } from "@/lib/collab/user-colors";
import { broadcastBoardLock } from "@/lib/realtime/pusher-server";
import {
  acquireLocks,
  listLocks,
  releaseLocks,
  type LockHolder,
} from "@/lib/boards/board-locks";

async function loadBoard(userId: string, id: string, role: "VIEWER" | "EDITOR") {
  const board = await prisma.document.findFirst({ where: { id } });
  if (!board || board.type !== "WHITEBOARD") return { error: "Not found", status: 404 } as const;
  try {
    await requireLibraryAccess(userId, board.libraryId, role);
  } catch (error) {
    if (error instanceof LibraryAccessError) {
      return { error: error.message, status: error.status } as const;
    }
    throw error;
  }
  return { board } as const;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await loadBoard(user.id, id, "VIEWER");
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  if (!isCollabConfigured()) return NextResponse.json({ locks: {} });
  return NextResponse.json({ locks: await listLocks(id) });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    elementIds?: string[];
    socketId?: string;
  } | null;
  const elementIds = body?.elementIds ?? [];

  const result = await loadBoard(user.id, id, "EDITOR");
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  // Single-user mode (no Redis/Pusher): nothing to coordinate — grant all.
  if (!isCollabConfigured()) {
    return NextResponse.json({ granted: elementIds, denied: [] });
  }

  const holder: LockHolder = {
    userId: user.id,
    name: user.name || user.email,
    color: colorForUser(user.id),
  };
  const { granted, denied } = await acquireLocks(id, elementIds, holder);

  if (granted.length > 0) {
    await broadcastBoardLock(id, granted, holder, body?.socketId).catch(() => {});
  }

  return NextResponse.json({ granted, denied });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    elementIds?: string[];
    socketId?: string;
  } | null;
  const elementIds = body?.elementIds ?? [];

  const result = await loadBoard(user.id, id, "EDITOR");
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  if (!isCollabConfigured()) return NextResponse.json({ released: elementIds });

  const released = await releaseLocks(id, elementIds, user.id);
  if (released.length > 0) {
    await broadcastBoardLock(id, released, null, body?.socketId).catch(() => {});
  }

  return NextResponse.json({ released });
}
