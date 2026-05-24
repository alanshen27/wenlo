import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { LibraryAccessError, requireLibraryAccess } from "@/lib/library-access";
import {
  leavePagePresence,
  listPageCollaborators,
  touchPagePresence,
} from "@/lib/page-presence";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

async function getPageForUser(pageId: string, userId: string) {
  const page = await prisma.page.findFirst({ where: { id: pageId } });
  if (!page) return null;
  await requireLibraryAccess(userId, page.libraryId, "VIEWER");
  return page;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: pageId } = await params;

  try {
    const page = await getPageForUser(pageId, user.id);
    if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const collaborators = await listPageCollaborators(pageId, user.id);
    return NextResponse.json({ collaborators });
  } catch (error) {
    if (error instanceof LibraryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: pageId } = await params;

  try {
    const page = await getPageForUser(pageId, user.id);
    if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await touchPagePresence(pageId, user);
    const collaborators = await listPageCollaborators(pageId, user.id);
    return NextResponse.json({ collaborators });
  } catch (error) {
    if (error instanceof LibraryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: pageId } = await params;
  await leavePagePresence(pageId, user.id);
  return NextResponse.json({ ok: true });
}
