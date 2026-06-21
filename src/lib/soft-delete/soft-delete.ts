import { prisma } from "@/lib/db/prisma";
import { notDeleted } from "@/lib/db/filters";
import { createAdminClient } from "@/lib/supabase/admin";
import { DOCUMENTS_BUCKET } from "@/lib/documents/storage";

const TRASH_RETENTION_DAYS = 30;

export async function softDeletePage(pageId: string) {
  await prisma.page.update({
    where: { id: pageId },
    data: { deletedAt: new Date() },
  });
}

export async function softDeleteDocument(documentId: string) {
  await prisma.document.update({
    where: { id: documentId },
    data: { deletedAt: new Date() },
  });
}

/** Soft-deletes a folder and all nested folders, pages, and documents. */
export async function softDeleteFolder(folderId: string) {
  const folder = await prisma.folder.findFirst({ where: { id: folderId } });
  if (!folder) return;

  const allFolderIds = await collectDescendantFolderIds(folder.libraryId, folderId);
  const ids = [folderId, ...allFolderIds];
  const now = new Date();

  await prisma.$transaction([
    prisma.folder.updateMany({ where: { id: { in: ids } }, data: { deletedAt: now } }),
    prisma.page.updateMany({
      where: { folderId: { in: ids }, ...notDeleted },
      data: { deletedAt: now },
    }),
    prisma.document.updateMany({
      where: { folderId: { in: ids }, ...notDeleted },
      data: { deletedAt: now },
    }),
  ]);
}

async function collectDescendantFolderIds(libraryId: string, rootId: string): Promise<string[]> {
  const folders = await prisma.folder.findMany({
    where: { libraryId, ...notDeleted },
    select: { id: true, parentId: true },
  });
  const children = new Map<string, string[]>();
  for (const f of folders) {
    if (!f.parentId) continue;
    const list = children.get(f.parentId) ?? [];
    list.push(f.id);
    children.set(f.parentId, list);
  }
  const result: string[] = [];
  const stack = children.get(rootId) ?? [];
  while (stack.length) {
    const id = stack.pop()!;
    result.push(id);
    stack.push(...(children.get(id) ?? []));
  }
  return result;
}

export async function restoreTrashItem(
  type: "page" | "document" | "folder",
  id: string
) {
  if (type === "page") {
    await prisma.page.update({ where: { id }, data: { deletedAt: null } });
    return;
  }
  if (type === "document") {
    await prisma.document.update({ where: { id }, data: { deletedAt: null } });
    return;
  }
  await prisma.folder.update({ where: { id }, data: { deletedAt: null } });
}

export async function permanentlyDeleteItem(
  type: "page" | "document" | "folder",
  id: string
) {
  if (type === "page") {
    await prisma.page.delete({ where: { id } });
    return;
  }
  if (type === "document") {
    const doc = await prisma.document.findFirst({ where: { id } });
    if (doc?.storagePath) {
      try {
        const supabase = createAdminClient();
        await supabase.storage.from(DOCUMENTS_BUCKET).remove([doc.storagePath]);
      } catch {
        /* ignore */
      }
    }
    await prisma.document.delete({ where: { id } });
    return;
  }
  await prisma.folder.delete({ where: { id } });
}

export async function purgeExpiredTrash() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - TRASH_RETENTION_DAYS);

  const [pages, documents, folders] = await Promise.all([
    prisma.page.findMany({
      where: { deletedAt: { lt: cutoff } },
      select: { id: true },
    }),
    prisma.document.findMany({
      where: { deletedAt: { lt: cutoff } },
      select: { id: true, storagePath: true },
    }),
    prisma.folder.findMany({
      where: { deletedAt: { lt: cutoff } },
      select: { id: true },
    }),
  ]);

  const storagePaths = documents
    .map((d) => d.storagePath)
    .filter((p): p is string => Boolean(p));

  if (storagePaths.length) {
    try {
      const supabase = createAdminClient();
      await supabase.storage.from(DOCUMENTS_BUCKET).remove(storagePaths);
    } catch {
      /* ignore */
    }
  }

  await prisma.$transaction([
    prisma.page.deleteMany({ where: { id: { in: pages.map((p) => p.id) } } }),
    prisma.document.deleteMany({ where: { id: { in: documents.map((d) => d.id) } } }),
    prisma.folder.deleteMany({ where: { id: { in: folders.map((f) => f.id) } } }),
  ]);

  return {
    pages: pages.length,
    documents: documents.length,
    folders: folders.length,
  };
}

export type TrashItem = {
  id: string;
  type: "page" | "document" | "folder";
  title: string;
  deletedAt: Date;
  documentType?: string;
};

export async function listTrashItems(libraryId: string): Promise<TrashItem[]> {
  const [pages, documents, folders] = await Promise.all([
    prisma.page.findMany({
      where: { libraryId, deletedAt: { not: null } },
      select: { id: true, title: true, deletedAt: true },
      orderBy: { deletedAt: "desc" },
    }),
    prisma.document.findMany({
      where: { libraryId, deletedAt: { not: null } },
      select: { id: true, title: true, deletedAt: true, type: true },
      orderBy: { deletedAt: "desc" },
    }),
    prisma.folder.findMany({
      where: { libraryId, deletedAt: { not: null } },
      select: { id: true, name: true, deletedAt: true },
      orderBy: { deletedAt: "desc" },
    }),
  ]);

  const items: TrashItem[] = [
    ...pages.map((p) => ({
      id: p.id,
      type: "page" as const,
      title: p.title,
      deletedAt: p.deletedAt!,
    })),
    ...documents.map((d) => ({
      id: d.id,
      type: "document" as const,
      title: d.title,
      deletedAt: d.deletedAt!,
      documentType: d.type,
    })),
    ...folders.map((f) => ({
      id: f.id,
      type: "folder" as const,
      title: f.name,
      deletedAt: f.deletedAt!,
    })),
  ];

  return items.sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
}
