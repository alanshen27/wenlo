import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/auth";
import { LibraryAccessError, requireLibraryAccess } from "@/lib/library/library-access";
import { prisma } from "@/lib/db/prisma";
import { databaseInclude, toDatabaseScene } from "@/lib/databases/database-server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const doc = await prisma.document.findFirst({ where: { id }, include: databaseInclude });
  if (!doc || doc.type !== "DATABASE") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await requireLibraryAccess(user.id, doc.libraryId, "VIEWER");
  } catch (error) {
    if (error instanceof LibraryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  return NextResponse.json(toDatabaseScene(doc));
}
