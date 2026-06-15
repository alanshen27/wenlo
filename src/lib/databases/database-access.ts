import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/auth";
import { LibraryAccessError, requireLibraryAccess } from "@/lib/library/library-access";
import { prisma } from "@/lib/db/prisma";
import type { LibraryRole } from "@/generated/prisma/client";

/** Thrown when a database document doesn't exist (or isn't a DATABASE). */
export class DatabaseNotFoundError extends Error {
  constructor() {
    super("Not found");
  }
}

export type DatabaseDocRef = {
  id: string;
  libraryId: string;
  title: string;
  folderId: string | null;
};

/**
 * Authenticate the caller, ensure the document exists and is a DATABASE, and
 * confirm the requested library role. Returns a minimal doc ref; throws
 * `DatabaseNotFoundError` / `LibraryAccessError` / an auth error otherwise.
 */
export async function requireDatabaseDoc(
  id: string,
  role: LibraryRole | "OWNER"
): Promise<{ userId: string; doc: DatabaseDocRef }> {
  const user = await requireUser();
  const doc = await prisma.document.findFirst({
    where: { id },
    select: { id: true, type: true, libraryId: true, title: true, folderId: true },
  });
  if (!doc || doc.type !== "DATABASE") throw new DatabaseNotFoundError();
  await requireLibraryAccess(user.id, doc.libraryId, role as LibraryRole);
  return {
    userId: user.id,
    doc: { id: doc.id, libraryId: doc.libraryId, title: doc.title, folderId: doc.folderId },
  };
}

/** Map a thrown error to the right JSON response for a database route. */
export function databaseErrorResponse(error: unknown): NextResponse {
  if (error instanceof DatabaseNotFoundError) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (error instanceof LibraryAccessError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  // Unauthenticated (requireUser throws) — treat anything else as 401/500.
  if (error instanceof Error && error.message === "Unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  throw error;
}
