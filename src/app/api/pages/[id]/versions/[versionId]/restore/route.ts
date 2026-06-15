import { NextRequest, NextResponse } from "next/server";
import { HttpError, notFound, withAuth } from "@/lib/api/http";
import { isCollabConfigured } from "@/lib/collab/config";
import { uint8ToBase64 } from "@/lib/collab/encoding";
import { overwritePageYjsFromContent } from "@/lib/collab/yjs-store";
import { requirePage } from "@/lib/pages/page-access";
import { getPageVersion, restorePageVersion } from "@/lib/pages/page-versions";
import {
  broadcastPageTitle,
  broadcastPageYjsUpdate,
} from "@/lib/realtime/pusher-server";
import { indexPage } from "@/lib/search/search";

type RouteParams = { params: Promise<{ id: string; versionId: string }> };

export async function POST(_req: NextRequest, ctx: RouteParams) {
  return withAuth(ctx, async ({ params, user }) => {
    const { id: pageId, versionId } = params;
    await requirePage(user.id, pageId, "EDITOR");

    const version = await getPageVersion(pageId, versionId);
    if (!version) throw notFound();

    const updated = await restorePageVersion(pageId, versionId, user);
    if (!updated) throw new HttpError(500, "Restore failed");

    await indexPage(updated.id, updated.title, updated.plainText, user.id).catch(() => {});

    if (isCollabConfigured()) {
      const state = await overwritePageYjsFromContent(pageId, version.content);
      await broadcastPageYjsUpdate(pageId, uint8ToBase64(state));
      await broadcastPageTitle(pageId, version.title);
    }

    return NextResponse.json(updated);
  });
}
