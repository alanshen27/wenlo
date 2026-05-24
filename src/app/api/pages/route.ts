import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { libraryIdFromFolder, resolveLibraryId } from "@/lib/libraries";
import {
  contentOwnerId,
  LibraryAccessError,
  requireLibraryAccess,
} from "@/lib/library-access";
import { prisma } from "@/lib/prisma";
import { indexPage } from "@/lib/search";
import { EMPTY_BLOCKS } from "@/lib/editor-content";

export async function GET(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const libraryId = await resolveLibraryId(
    user.id,
    req.nextUrl.searchParams.get("libraryId")
  );
  await requireLibraryAccess(user.id, libraryId, "VIEWER");

  const folderId = req.nextUrl.searchParams.get("folderId");

  const pages = await prisma.page.findMany({
    where: {
      libraryId,
      ...(folderId ? { folderId: folderId === "root" ? null : folderId } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(pages);
}

export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, folderId, libraryId: rawLibraryId, content } = await req.json();

  try {
    const libraryId = await libraryIdFromFolder(
      user.id,
      folderId,
      await resolveLibraryId(user.id, rawLibraryId)
    );
    await requireLibraryAccess(user.id, libraryId, "EDITOR");
    const ownerId = await contentOwnerId(libraryId);

    const page = await prisma.page.create({
      data: {
        title: title?.trim() || "Untitled",
        userId: ownerId,
        libraryId,
        folderId: folderId && folderId !== "__root__" ? folderId : null,
        content: content ?? EMPTY_BLOCKS,
        plainText: "",
      },
    });

    await indexPage(page.id, page.title, "").catch(() => {});

    return NextResponse.json(page);
  } catch (error) {
    if (error instanceof LibraryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
