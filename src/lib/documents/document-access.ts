import { prisma } from "@/lib/db/prisma";
import { notFound } from "@/lib/api/http";
import { requireLibraryAccess, type LibraryRole } from "@/lib/library/library-access";
import type { Document, DocumentType } from "@/generated/prisma/client";

/**
 * Load a document by id, optionally assert its `type`, and confirm the caller's
 * library role. Throws `notFound()` for a missing/wrong-type document and
 * `LibraryAccessError` when the role check fails — both handled by
 * `errorResponse`. Centralizes the fetch-then-authorize combo that every
 * document-backed route repeats.
 */
export async function requireDocument(
  userId: string,
  id: string,
  opts: { type?: DocumentType; role?: LibraryRole } = {}
): Promise<Document> {
  const doc = await prisma.document.findFirst({ where: { id } });
  if (!doc || (opts.type && doc.type !== opts.type)) throw notFound();
  await requireLibraryAccess(userId, doc.libraryId, opts.role ?? "VIEWER");
  return doc;
}
