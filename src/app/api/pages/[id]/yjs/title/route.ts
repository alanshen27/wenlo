import { NextRequest, NextResponse } from "next/server";
import { badRequest, withAuth } from "@/lib/api/http";
import { broadcastPageTitle } from "@/lib/realtime/pusher-server";
import { requirePage } from "@/lib/pages/page-access";
import { snapshotPageBeforeUpdate } from "@/lib/pages/page-versions";
import { indexPage } from "@/lib/search/search";
import { prisma } from "@/lib/db/prisma";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteParams) {
  return withAuth(ctx, async ({ params, user }) => {
    const pageId = params.id;
    const { title } = await req.json();

    if (typeof title !== "string") throw badRequest("title required");

    const page = await requirePage(user.id, pageId, "EDITOR");

    const trimmed = title.trim() || "Untitled";
    if (trimmed !== page.title) {
      await snapshotPageBeforeUpdate(page, user).catch(() => {});
    }

    const updated = await prisma.page.update({
      where: { id: pageId },
      data: { title: trimmed },
    });

    await indexPage(updated.id, updated.title, updated.plainText, user.id).catch(() => {});
    await broadcastPageTitle(pageId, trimmed);

    return NextResponse.json(updated);
  });
}
