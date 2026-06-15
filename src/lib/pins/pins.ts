import { prisma } from "@/lib/db/prisma";

export type PinnedIds = {
  pageIds: Set<string>;
  documentIds: Set<string>;
};

/** All page/document ids the user has pinned, split by kind. */
export async function listPinnedIds(userId: string): Promise<PinnedIds> {
  const pins = await prisma.pin.findMany({
    where: { userId },
    select: { pageId: true, documentId: true },
  });
  const pageIds = new Set<string>();
  const documentIds = new Set<string>();
  for (const pin of pins) {
    if (pin.pageId) pageIds.add(pin.pageId);
    if (pin.documentId) documentIds.add(pin.documentId);
  }
  return { pageIds, documentIds };
}
