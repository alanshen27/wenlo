import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/auth";
import { LibraryAccessError, requireLibraryAccess } from "@/lib/library/library-access";
import { getPageVersion } from "@/lib/pages/page-versions";
import { prisma } from "@/lib/db/prisma";

type RouteParams = { params: Promise<{ id: string; versionId: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: pageId, versionId } = await params;
  const page = await prisma.page.findFirst({ where: { id: pageId } });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await requireLibraryAccess(user.id, page.libraryId, "VIEWER");
    const version = await getPageVersion(pageId, versionId);
    if (!version) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
      ...version,
      createdAt: version.createdAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof LibraryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
