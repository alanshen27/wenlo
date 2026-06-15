import { requireUser } from "@/lib/auth/auth";
import { notFound } from "@/lib/api/http";
import { requireLibraryAccess } from "@/lib/library/library-access";
import { prisma } from "@/lib/db/prisma";
import type { LibraryRole } from "@/generated/prisma/client";

export type DatabaseDocRef = {
  id: string;
  libraryId: string;
  title: string;
  folderId: string | null;
};

/**
 * Authenticate the caller, ensure the document exists and is a DATABASE, and
 * confirm the requested library role. Returns a minimal doc ref; throws
 * `notFound()` / `LibraryAccessError` / an auth error otherwise — all mapped to
 * a response by {@link errorResponse} when wrapped in `withRoute`/`withAuth`.
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
  if (!doc || doc.type !== "DATABASE") throw notFound();
  await requireLibraryAccess(user.id, doc.libraryId, role as LibraryRole);
  return {
    userId: user.id,
    doc: { id: doc.id, libraryId: doc.libraryId, title: doc.title, folderId: doc.folderId },
  };
}
