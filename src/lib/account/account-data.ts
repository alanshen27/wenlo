import JSZip from "jszip";
import { prisma } from "@/lib/db/prisma";
import { notDeleted } from "@/lib/db/filters";
import { createAdminClient } from "@/lib/supabase/admin";
import { DOCUMENTS_BUCKET } from "@/lib/documents/storage";

export async function exportUserData(userId: string): Promise<Buffer> {
  const zip = new JSZip();

  const [libraries, pages, documents, folders] = await Promise.all([
    prisma.library.findMany({
      where: { OR: [{ userId }, { members: { some: { userId } } }] },
    }),
    prisma.page.findMany({ where: { userId, ...notDeleted } }),
    prisma.document.findMany({ where: { userId, ...notDeleted } }),
    prisma.folder.findMany({ where: { userId, ...notDeleted } }),
  ]);

  zip.file(
    "export.json",
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        libraries,
        folders,
        pages: pages.map((p) => ({
          id: p.id,
          title: p.title,
          content: p.content,
          plainText: p.plainText,
          libraryId: p.libraryId,
          folderId: p.folderId,
        })),
        documents: documents.map((d) => ({
          id: d.id,
          title: d.title,
          type: d.type,
          content: d.content,
          libraryId: d.libraryId,
          folderId: d.folderId,
          storagePath: d.storagePath,
        })),
      },
      null,
      2
    )
  );

  const supabase = createAdminClient();
  for (const doc of documents) {
    if (!doc.storagePath) continue;
    try {
      const { data } = await supabase.storage.from(DOCUMENTS_BUCKET).download(doc.storagePath);
      if (data) {
        const buffer = Buffer.from(await data.arrayBuffer());
        zip.file(`files/${doc.id}-${doc.title}`, buffer);
      }
    } catch {
      /* skip missing files */
    }
  }

  return zip.generateAsync({ type: "nodebuffer" });
}

export async function deleteUserAccount(userId: string) {
  const documents = await prisma.document.findMany({
    where: { userId },
    select: { storagePath: true },
  });
  const paths = documents.map((d) => d.storagePath).filter((p): p is string => Boolean(p));

  if (paths.length) {
    try {
      const supabase = createAdminClient();
      await supabase.storage.from(DOCUMENTS_BUCKET).remove(paths);
    } catch {
      /* ignore */
    }
  }

  await prisma.user.delete({ where: { id: userId } });

  try {
    const supabase = createAdminClient();
    await supabase.auth.admin.deleteUser(userId);
  } catch {
    /* user may already be gone */
  }
}
