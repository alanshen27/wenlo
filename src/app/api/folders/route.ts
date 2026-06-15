import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { badRequest, notFound, parseBody, withAuth } from "@/lib/api/http";
import { resolveLibraryId } from "@/lib/library/libraries";
import { contentOwnerId, requireLibraryAccess } from "@/lib/library/library-access";
import { prisma } from "@/lib/db/prisma";
import { buildFolderTree } from "@/lib/library/folders";
import { listPinnedIds } from "@/lib/pins/pins";

export async function GET(req: NextRequest) {
  return withAuth(undefined, async ({ user }) => {
    const libraryId = await resolveLibraryId(
      user.id,
      req.nextUrl.searchParams.get("libraryId")
    );
    await requireLibraryAccess(user.id, libraryId, "VIEWER");

    const [folders, pages, documents, pinned] = await Promise.all([
      prisma.folder.findMany({ where: { libraryId }, orderBy: { name: "asc" } }),
      prisma.page.findMany({
        where: { libraryId },
        select: { id: true, title: true, folderId: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.document.findMany({
        where: { libraryId },
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          folderId: true,
          sizeBytes: true,
        },
        orderBy: { updatedAt: "desc" },
      }),
      listPinnedIds(user.id),
    ]);

    return NextResponse.json({
      tree: buildFolderTree(folders, pages, documents, pinned),
      folders,
    });
  });
}

const createSchema = z.object({
  name: z.string().optional(),
  parentId: z.string().nullish(),
  libraryId: z.string().nullish(),
  color: z.string().optional(),
});

export async function POST(req: NextRequest) {
  return withAuth(undefined, async ({ user }) => {
    const { name, parentId, libraryId: rawLibraryId, color } = await parseBody(req, createSchema);
    if (!name?.trim()) throw badRequest("Name required");

    let libraryId = await resolveLibraryId(user.id, rawLibraryId ?? null);
    await requireLibraryAccess(user.id, libraryId, "EDITOR");

    if (parentId) {
      const parent = await prisma.folder.findFirst({ where: { id: parentId, libraryId } });
      if (!parent) throw notFound("Parent folder not found");
      libraryId = parent.libraryId;
    }

    const ownerId = await contentOwnerId(libraryId);
    const folder = await prisma.folder.create({
      data: {
        name: name.trim(),
        color: color || "yellow",
        userId: ownerId,
        libraryId,
        parentId: parentId || null,
      },
    });

    return NextResponse.json(folder);
  });
}
