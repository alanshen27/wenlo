import { prisma } from "@/lib/db/prisma";
import { listLibrariesWithRoles } from "@/lib/library/libraries";
import {
  NATIVE_DOC_TYPES,
  NATIVE_TYPES,
  type NativeKind,
} from "@/lib/native/native-types";

export type RecentItem = {
  id: string;
  title: string;
  /** Artwork/icon key: "PAGE" for docs, the DocumentType otherwise. */
  type: string;
  /** Plain-text excerpt for a content thumbnail (docs). Null when not text. */
  preview: string | null;
  libraryId: string;
  libraryName: string;
  libraryIcon: string;
  folderId: string | null;
  updatedAt: string;
  sizeBytes: number | null;
};

/** Trim a plain-text body down to a thumbnail-sized excerpt. */
function toPreview(text: string | null | undefined): string | null {
  const trimmed = text?.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 600);
}

/**
 * Recent items of a given native kind across every library the user can access.
 * Powers the Word-style home pages, which are intentionally library-agnostic.
 */
export async function listRecents(
  userId: string,
  kind: NativeKind,
  limit = 24
): Promise<RecentItem[]> {
  const libraries = await listLibrariesWithRoles(userId);
  if (libraries.length === 0) return [];

  const libMap = new Map(libraries.map((l) => [l.id, l]));
  const libraryIds = libraries.map((l) => l.id);
  const cfg = NATIVE_TYPES[kind];

  const libMeta = (libraryId: string) => ({
    libraryName: libMap.get(libraryId)?.name ?? "Library",
    libraryIcon: libMap.get(libraryId)?.icon ?? "",
  });

  if (cfg.source === "page") {
    const pages = await prisma.page.findMany({
      where: { libraryId: { in: libraryIds } },
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: {
        id: true,
        title: true,
        plainText: true,
        libraryId: true,
        folderId: true,
        updatedAt: true,
      },
    });
    return pages.map((p) => ({
      id: p.id,
      title: p.title,
      type: "PAGE",
      preview: toPreview(p.plainText),
      libraryId: p.libraryId,
      folderId: p.folderId,
      updatedAt: p.updatedAt.toISOString(),
      sizeBytes: null,
      ...libMeta(p.libraryId),
    }));
  }

  const where =
    cfg.source === "document" && cfg.docType
      ? { libraryId: { in: libraryIds }, type: cfg.docType }
      : { libraryId: { in: libraryIds }, type: { notIn: NATIVE_DOC_TYPES } };

  const docs = await prisma.document.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      type: true,
      libraryId: true,
      folderId: true,
      updatedAt: true,
      sizeBytes: true,
    },
  });
  return docs.map((d) => ({
    id: d.id,
    title: d.title,
    type: d.type,
    preview: null,
    libraryId: d.libraryId,
    folderId: d.folderId,
    updatedAt: d.updatedAt.toISOString(),
    sizeBytes: d.sizeBytes,
    ...libMeta(d.libraryId),
  }));
}
