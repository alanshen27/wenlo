import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/auth";
import { LibraryAccessError, requireLibraryAccess } from "@/lib/library/library-access";
import { buildFolderTree } from "@/lib/library/folders";
import { buildPageGraph } from "@/lib/pages/page-graph";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: libraryId } = await params;

  try {
    await requireLibraryAccess(user.id, libraryId, "VIEWER");
  } catch (error) {
    if (error instanceof LibraryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const [library, folders, pages, documents] = await Promise.all([
    prisma.library.findUniqueOrThrow({ where: { id: libraryId }, select: { name: true } }),
    prisma.folder.findMany({
      where: { libraryId },
      select: { id: true, name: true, color: true, parentId: true },
    }),
    prisma.page.findMany({
      where: { libraryId },
      select: { id: true, title: true, folderId: true, content: true },
    }),
    prisma.document.findMany({
      where: { libraryId },
      select: { id: true, title: true, type: true, folderId: true },
    }),
  ]);

  const tree = buildFolderTree(folders, pages, documents);
  const graph = buildPageGraph(library.name, tree, pages, libraryId);

  return NextResponse.json(graph);
}
