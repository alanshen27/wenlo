import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/auth";
import { broadcastPageTitle } from "@/lib/realtime/pusher-server";
import { LibraryAccessError, requireLibraryAccess } from "@/lib/library/library-access";
import { snapshotPageBeforeUpdate } from "@/lib/pages/page-versions";
import { indexPage } from "@/lib/search/search";
import { prisma } from "@/lib/db/prisma";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: pageId } = await params;
  const { title } = await req.json();

  if (typeof title !== "string") {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

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

  const trimmed = title.trim() || "Untitled";
  if (trimmed !== page.title) {
    await snapshotPageBeforeUpdate(page, user).catch(() => {});
  }

  const updated = await prisma.page.update({
    where: { id: pageId },
    data: { title: trimmed },
  });

  await indexPage(updated.id, updated.title, updated.plainText).catch(() => {});
  await broadcastPageTitle(pageId, trimmed);

  return NextResponse.json(updated);
}
