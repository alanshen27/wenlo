import { NextResponse, type NextRequest } from "next/server";
import { notFound, withAuth } from "@/lib/api/http";
import { requireLibraryAccess } from "@/lib/library/library-access";
import { prisma } from "@/lib/db/prisma";
import { databaseInclude, toDatabaseScene } from "@/lib/databases/database-server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  return withAuth(ctx, async ({ params, user }) => {
    const doc = await prisma.document.findFirst({
      where: { id: params.id },
      include: databaseInclude,
    });
    if (!doc || doc.type !== "DATABASE") throw notFound();
    await requireLibraryAccess(user.id, doc.libraryId, "VIEWER");
    return NextResponse.json(toDatabaseScene(doc));
  });
}
