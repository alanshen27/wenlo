import { prisma } from "@/lib/db/prisma";
import { listLibrariesWithRoles } from "@/lib/library/libraries";
import { listLibraryCollaborators, type Collaborator } from "@/lib/library/collaborators";
import { listPinnedIds } from "@/lib/pins/pins";
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
  createdAt: string;
  sizeBytes: number | null;
  /** True when the item lives in a library shared with the user (not owned). */
  shared: boolean;
  /** True when the current user has pinned this item. */
  pinned: boolean;
  /** Other people with access to this item's library (for "shared with" avatars). */
  collaborators: Collaborator[];
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
 *
 * Pinned items are always included even when they fall outside the recency
 * window, so the home page can render a stable "Pinned" section.
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
  const [pinned, collaboratorsByLibrary] = await Promise.all([
    listPinnedIds(userId),
    listLibraryCollaborators(userId, libraryIds),
  ]);

  const libMeta = (libraryId: string) => ({
    libraryName: libMap.get(libraryId)?.name ?? "Library",
    libraryIcon: libMap.get(libraryId)?.icon ?? "",
    shared: libMap.get(libraryId)?.isShared ?? false,
    collaborators: collaboratorsByLibrary.get(libraryId) ?? [],
  });

  if (cfg.source === "page") {
    const pinnedPageIds = [...pinned.pageIds];
    const [recent, pinnedPages] = await Promise.all([
      prisma.page.findMany({
        where: { libraryId: { in: libraryIds } },
        orderBy: { updatedAt: "desc" },
        take: limit,
        select: pageSelect,
      }),
      pinnedPageIds.length > 0
        ? prisma.page.findMany({
            where: { id: { in: pinnedPageIds }, libraryId: { in: libraryIds } },
            orderBy: { updatedAt: "desc" },
            select: pageSelect,
          })
        : Promise.resolve([]),
    ]);

    const merged = dedupeById([...recent, ...pinnedPages]);
    return merged.map((p) => ({
      id: p.id,
      title: p.title,
      type: "PAGE",
      preview: toPreview(p.plainText),
      libraryId: p.libraryId,
      folderId: p.folderId,
      updatedAt: p.updatedAt.toISOString(),
      createdAt: p.createdAt.toISOString(),
      sizeBytes: null,
      pinned: pinned.pageIds.has(p.id),
      ...libMeta(p.libraryId),
    }));
  }

  const where =
    cfg.source === "document" && cfg.docType
      ? { libraryId: { in: libraryIds }, type: cfg.docType }
      : { libraryId: { in: libraryIds }, type: { notIn: NATIVE_DOC_TYPES } };

  const pinnedDocIds = [...pinned.documentIds];
  const [recent, pinnedDocs] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: docSelect,
    }),
    pinnedDocIds.length > 0
      ? prisma.document.findMany({
          where: { ...where, id: { in: pinnedDocIds } },
          orderBy: { updatedAt: "desc" },
          select: docSelect,
        })
      : Promise.resolve([]),
  ]);

  const merged = dedupeById([...recent, ...pinnedDocs]);
  return merged.map((d) => ({
    id: d.id,
    title: d.title,
    type: d.type,
    preview: null,
    libraryId: d.libraryId,
    folderId: d.folderId,
    updatedAt: d.updatedAt.toISOString(),
    createdAt: d.createdAt.toISOString(),
    sizeBytes: d.sizeBytes,
    pinned: pinned.documentIds.has(d.id),
    ...libMeta(d.libraryId),
  }));
}

const pageSelect = {
  id: true,
  title: true,
  plainText: true,
  libraryId: true,
  folderId: true,
  createdAt: true,
  updatedAt: true,
} as const;

const docSelect = {
  id: true,
  title: true,
  type: true,
  libraryId: true,
  folderId: true,
  createdAt: true,
  updatedAt: true,
  sizeBytes: true,
} as const;

function dedupeById<T extends { id: string; updatedAt: Date }>(items: T[]): T[] {
  const seen = new Map<string, T>();
  for (const item of items) {
    if (!seen.has(item.id)) seen.set(item.id, item);
  }
  return [...seen.values()].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}
