import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { resolveLibraryId } from "@/lib/libraries";
import { prisma } from "@/lib/prisma";
import { buildFolderTree } from "@/lib/folders";

export async function GET(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const libraryId = await resolveLibraryId(
    user.id,
    req.nextUrl.searchParams.get("libraryId")
  );

  const [folders, pages, documents] = await Promise.all([
    prisma.folder.findMany({
      where: { userId: user.id, libraryId },
      orderBy: { name: "asc" },
    }),
    prisma.page.findMany({
      where: { userId: user.id, libraryId },
      select: { id: true, title: true, folderId: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.document.findMany({
      where: { userId: user.id, libraryId },
      select: { id: true, title: true, type: true, folderId: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return NextResponse.json({ tree: buildFolderTree(folders, pages, documents), folders });
}

export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, parentId, libraryId: rawLibraryId, color } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }

  let libraryId = await resolveLibraryId(user.id, rawLibraryId);

  if (parentId) {
    const parent = await prisma.folder.findFirst({
      where: { id: parentId, userId: user.id },
    });
    if (!parent) return NextResponse.json({ error: "Parent folder not found" }, { status: 404 });
    libraryId = parent.libraryId;
  }

  const folder = await prisma.folder.create({
    data: {
      name: name.trim(),
      color: color || "gray",
      userId: user.id,
      libraryId,
      parentId: parentId || null,
    },
  });

  return NextResponse.json(folder);
}
