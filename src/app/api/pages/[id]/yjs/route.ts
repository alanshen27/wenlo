import { NextRequest, NextResponse } from "next/server";
import { badRequest, HttpError, withAuth } from "@/lib/api/http";
import { isCollabConfigured } from "@/lib/collab/config";
import { base64ToUint8, uint8ToBase64 } from "@/lib/collab/encoding";
import { mergePageYjsUpdate, readPageYjsState, seedPageYjsStateFromContent } from "@/lib/collab/yjs-store";
import { requirePage } from "@/lib/pages/page-access";
import { broadcastPageAwareness, broadcastPageYjsUpdate } from "@/lib/realtime/pusher-server";

type RouteParams = { params: Promise<{ id: string }> };

const collabUnavailable = () => new HttpError(503, "Collaboration is not configured");

export async function GET(_req: NextRequest, ctx: RouteParams) {
  return withAuth(ctx, async ({ params, user }) => {
    if (!isCollabConfigured()) throw collabUnavailable();

    const pageId = params.id;
    const page = await requirePage(user.id, pageId);

    let state = await readPageYjsState(pageId);
    if (!state) {
      state = (await seedPageYjsStateFromContent(pageId, page.content)) as Uint8Array<ArrayBuffer>;
    }
    return NextResponse.json({ state: state ? uint8ToBase64(state) : null });
  });
}

export async function POST(req: NextRequest, ctx: RouteParams) {
  return withAuth(ctx, async ({ params, user }) => {
    if (!isCollabConfigured()) throw collabUnavailable();

    const pageId = params.id;
    await requirePage(user.id, pageId, "EDITOR");

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

    if (!update) throw badRequest("update or awareness required");

    const updateBytes = base64ToUint8(update);
    await mergePageYjsUpdate(pageId, updateBytes);
    await broadcastPageYjsUpdate(
      pageId,
      update,
      typeof clientId === "number" ? clientId : undefined
    );

    return NextResponse.json({ ok: true });
  });
}
