import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { isCollabConfigured } from "@/lib/collab/config";
import { base64ToUint8, uint8ToBase64 } from "@/lib/collab/encoding";
import { mergePageYjsUpdate, readPageYjsState, seedPageYjsStateFromContent } from "@/lib/collab/yjs-store";
import { LibraryAccessError, requireLibraryAccess } from "@/lib/library-access";
import { broadcastPageAwareness, broadcastPageYjsUpdate } from "@/lib/pusher-server";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

async function getPage(pageId: string) {
  return prisma.page.findFirst({ where: { id: pageId } });
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  if (!isCollabConfigured()) {
    return NextResponse.json({ error: "Collaboration is not configured" }, { status: 503 });
  }

  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: pageId } = await params;
  const page = await getPage(pageId);
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await requireLibraryAccess(user.id, page.libraryId, "VIEWER");
    let state = await readPageYjsState(pageId);
    if (!state) {
      state = await seedPageYjsStateFromContent(pageId, page.content) as Uint8Array<ArrayBuffer>;
    }
    return NextResponse.json({ state: state ? uint8ToBase64(state) : null });
  } catch (error) {
    if (error instanceof LibraryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  if (!isCollabConfigured()) {
    return NextResponse.json({ error: "Collaboration is not configured" }, { status: 503 });
  }

  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: pageId } = await params;
  const page = await getPage(pageId);
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await requireLibraryAccess(user.id, page.libraryId, "EDITOR");
  } catch (error) {
    if (error instanceof LibraryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const body = await req.json();
  const { update, awareness, clientId } = body as {
    update?: string;
    awareness?: string;
    clientId?: number;
  };

  if (awareness) {
    await broadcastPageAwareness(pageId, awareness);
    return NextResponse.json({ ok: true });
  }

  if (!update) {
    return NextResponse.json({ error: "update or awareness required" }, { status: 400 });
  }

  const updateBytes = base64ToUint8(update);
  await mergePageYjsUpdate(pageId, updateBytes);
  await broadcastPageYjsUpdate(
    pageId,
    update,
    typeof clientId === "number" ? clientId : undefined
  );

  return NextResponse.json({ ok: true });
}
