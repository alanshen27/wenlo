import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/http";
import { libraryIdFromFolder, resolveLibraryId } from "@/lib/library/libraries";
import { contentOwnerId, requireLibraryAccess } from "@/lib/library/library-access";
import { prisma } from "@/lib/db/prisma";
import { indexPage } from "@/lib/search/search";
import { isCollabConfigured } from "@/lib/collab/config";
import { seedPageYjsStateFromContent } from "@/lib/collab/yjs-store";
import { EMPTY_BLOCKS, extractPlainText } from "@/lib/editor/editor-content";

export async function GET(req: NextRequest) {
  return withAuth(undefined, async ({ user }) => {
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
  });
}

export async function POST(req: NextRequest) {
  return withAuth(undefined, async ({ user }) => {
    const { title, folderId, libraryId: rawLibraryId, content } = await req.json();

    const libraryId = await libraryIdFromFolder(
      user.id,
      folderId,
      await resolveLibraryId(user.id, rawLibraryId)
    );
    await requireLibraryAccess(user.id, libraryId, "EDITOR");
    const ownerId = await contentOwnerId(libraryId);

    const normalizedContent = content ?? EMPTY_BLOCKS;
    const page = await prisma.page.create({
      data: {
        title: title?.trim() || "Untitled",
        userId: ownerId,
        libraryId,
        folderId: folderId && folderId !== "__root__" ? folderId : null,
        content: normalizedContent,
        plainText: extractPlainText(normalizedContent),
      },
    });

    await indexPage(page.id, page.title, page.plainText, user.id).catch(() => {});

    if (isCollabConfigured() && normalizedContent !== EMPTY_BLOCKS) {
      await seedPageYjsStateFromContent(page.id, normalizedContent).catch((err) => {
        console.error("[pages] yjs seed failed on create", page.id, err);
      });
    }

    return NextResponse.json(page);
  });
}
