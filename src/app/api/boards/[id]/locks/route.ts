import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/http";
import { requireDocument } from "@/lib/documents/document-access";
import { isCollabConfigured } from "@/lib/collab/config";
import { colorForUser } from "@/lib/collab/user-colors";
import { broadcastBoardLock } from "@/lib/realtime/pusher-server";
import {
  acquireLocks,
  listLocks,
  releaseLocks,
  type LockHolder,
} from "@/lib/boards/board-locks";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  return withAuth(ctx, async ({ params, user }) => {
    const { id } = params;
    await requireDocument(user.id, id, { type: "WHITEBOARD" });

    if (!isCollabConfigured()) return NextResponse.json({ locks: {} });
    return NextResponse.json({ locks: await listLocks(id) });
  });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  return withAuth(ctx, async ({ params, user }) => {
    const { id } = params;
    const body = (await req.json().catch(() => null)) as {
      elementIds?: string[];
      socketId?: string;
    } | null;
    const elementIds = body?.elementIds ?? [];

    await requireDocument(user.id, id, { type: "WHITEBOARD", role: "EDITOR" });

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
  });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  return withAuth(ctx, async ({ params, user }) => {
    const { id } = params;
    const body = (await req.json().catch(() => null)) as {
      elementIds?: string[];
      socketId?: string;
    } | null;
    const elementIds = body?.elementIds ?? [];

    await requireDocument(user.id, id, { type: "WHITEBOARD", role: "EDITOR" });

    if (!isCollabConfigured()) return NextResponse.json({ released: elementIds });

    const released = await releaseLocks(id, elementIds, user.id);
    if (released.length > 0) {
      await broadcastBoardLock(id, released, null, body?.socketId).catch(() => {});
    }

    return NextResponse.json({ released });
  });
}
