import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/http";
import { prisma } from "@/lib/db/prisma";
import { notDeleted } from "@/lib/db/filters";
import { listLibrariesWithRoles } from "@/lib/library/libraries";

export async function GET() {
  return withAuth(undefined, async ({ user }) => {
    const libraries = await listLibrariesWithRoles(user.id);
    const libraryIds = libraries.map((l) => l.id);

    const [pages, documents] = await Promise.all([
      prisma.page.findMany({
        where: { libraryId: { in: libraryIds }, ...notDeleted },
        select: { id: true, title: true, libraryId: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 8,
      }),
      prisma.document.findMany({
        where: { libraryId: { in: libraryIds }, ...notDeleted },
        select: { id: true, title: true, libraryId: true, type: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 8,
      }),
    ]);

    const items = [
      ...pages.map((p) => ({
        id: p.id,
        title: p.title,
        kind: "page" as const,
        libraryId: p.libraryId,
        updatedAt: p.updatedAt,
      })),
      ...documents.map((d) => ({
        id: d.id,
        title: d.title,
        kind: "document" as const,
        documentType: d.type,
        libraryId: d.libraryId,
        updatedAt: d.updatedAt,
      })),
    ]
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 8);

    return NextResponse.json({ items });
  });
}
