import { prisma } from "@/lib/db/prisma";
import { notFound } from "@/lib/api/http";
import { requireLibraryAccess, type LibraryRole } from "@/lib/library/library-access";
import type { Page } from "@/generated/prisma/client";

/**
 * Load a page by id and confirm the caller's library role. Throws `notFound()`
 * for a missing page and `LibraryAccessError` when the role check fails — both
 * mapped to a response by `errorResponse` when wrapped in `withAuth`.
 */
export async function requirePage(
  userId: string,
  id: string,
  role: LibraryRole = "VIEWER"
): Promise<Page> {
  const page = await prisma.page.findFirst({ where: { id } });
  if (!page) throw notFound();
  await requireLibraryAccess(userId, page.libraryId, role);
  return page;
}
