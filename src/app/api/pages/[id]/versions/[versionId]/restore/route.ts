import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/auth";
import { isCollabConfigured } from "@/lib/collab/config";
import { uint8ToBase64 } from "@/lib/collab/encoding";
import { overwritePageYjsFromContent } from "@/lib/collab/yjs-store";
import { LibraryAccessError, requireLibraryAccess } from "@/lib/library/library-access";
import { getPageVersion, restorePageVersion } from "@/lib/pages/page-versions";
import {
  broadcastPageTitle,
  broadcastPageYjsUpdate,
} from "@/lib/realtime/pusher-server";
import { prisma } from "@/lib/db/prisma";
import { indexPage } from "@/lib/search/search";

type RouteParams = { params: Promise<{ id: string; versionId: string }> };

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: pageId, versionId } = await params;
  const page = await prisma.page.findFirst({ where: { id: pageId } });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await requireLibraryAccess(user.id, page.libraryId, "EDITOR");
  } catch (error) {
    if (error instanceof LibraryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const version = await getPageVersion(pageId, versionId);
  if (!version) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await restorePageVersion(pageId, versionId, user);
  if (!updated) return NextResponse.json({ error: "Restore failed" }, { status: 500 });

  await indexPage(updated.id, updated.title, updated.plainText, user.id).catch(() => {});

  if (isCollabConfigured()) {
    const state = await overwritePageYjsFromContent(pageId, version.content);
    await broadcastPageYjsUpdate(pageId, uint8ToBase64(state));
    await broadcastPageTitle(pageId, version.title);
  }

  return NextResponse.json(updated);
}
