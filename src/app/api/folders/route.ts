import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { resolveLibraryId } from "@/lib/libraries";
import {
  contentOwnerId,
  LibraryAccessError,
  requireLibraryAccess,
} from "@/lib/library-access";
import { prisma } from "@/lib/prisma";
import { buildFolderTree } from "@/lib/folders";

export async function GET(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const libraryId = await resolveLibraryId(
      user.id,
      req.nextUrl.searchParams.get("libraryId")
    );
    await requireLibraryAccess(user.id, libraryId, "VIEWER");

    const [folders, pages, documents] = await Promise.all([
      prisma.folder.findMany({
        where: { libraryId },
        orderBy: { name: "asc" },
      }),
      prisma.page.findMany({
        where: { libraryId },
        select: { id: true, title: true, folderId: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.document.findMany({
        where: { libraryId },
        select: { id: true, title: true, type: true, folderId: true },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    return NextResponse.json({ tree: buildFolderTree(folders, pages, documents), folders });
  } catch (error) {
    if (error instanceof LibraryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}

export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, parentId, libraryId: rawLibraryId, color } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }

  try {
    let libraryId = await resolveLibraryId(user.id, rawLibraryId);
    await requireLibraryAccess(user.id, libraryId, "EDITOR");

    if (parentId) {
      const parent = await prisma.folder.findFirst({
        where: { id: parentId, libraryId },
      });
      if (!parent) return NextResponse.json({ error: "Parent folder not found" }, { status: 404 });
      libraryId = parent.libraryId;
    }

    const ownerId = await contentOwnerId(libraryId);
    const folder = await prisma.folder.create({
      data: {
        name: name.trim(),
        color: color || "gray",
        userId: ownerId,
        libraryId,
        parentId: parentId || null,
      },
    });

    return NextResponse.json(folder);
  } catch (error) {
    if (error instanceof LibraryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
