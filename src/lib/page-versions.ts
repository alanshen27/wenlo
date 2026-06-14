import type { Page, User } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const MAX_PAGE_VERSIONS = 100;
/** Minimum gap between automatic snapshots during active editing. */
export const MIN_SNAPSHOT_INTERVAL_MS = 60 * 60_000;

export type PageVersionSummary = {
  id: string;
  title: string;
  plainText: string;
  createdById: string;
  createdByName: string | null;
  createdAt: string;
};

function stableContentKey(content: unknown) {
  return JSON.stringify(content);
}

function pageSnapshot(page: Pick<Page, "title" | "content" | "plainText">) {
  return {
    title: page.title,
    content: page.content,
    plainText: page.plainText,
    contentKey: stableContentKey(page.content),
  };
}

async function getLatestVersion(pageId: string) {
  return prisma.pageVersion.findFirst({
    where: { pageId },
    orderBy: { createdAt: "desc" },
  });
}

async function trimOldVersions(pageId: string) {
  const versions = await prisma.pageVersion.findMany({
    where: { pageId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
    skip: MAX_PAGE_VERSIONS,
  });
  if (versions.length === 0) return;
  await prisma.pageVersion.deleteMany({
    where: { id: { in: versions.map((v) => v.id) } },
  });
}

type SnapshotOptions = {
  /** Bypass the minimum interval throttle (e.g. before restore). */
  force?: boolean;
};

/**
 * Saves the current page state as a version before it is overwritten.
 * Skips if unchanged from the latest version or throttled during rapid saves.
 */
export async function snapshotPageBeforeUpdate(
  page: Page,
  user: Pick<User, "id" | "name" | "email">,
  options: SnapshotOptions = {}
) {
  const snap = pageSnapshot(page);
  const latest = await getLatestVersion(page.id);

  if (latest) {
    const latestKey = stableContentKey(latest.content);
    if (latest.title === snap.title && latestKey === snap.contentKey) {
      return null;
    }

    if (!options.force) {
      const elapsed = Date.now() - latest.createdAt.getTime();
      if (elapsed < MIN_SNAPSHOT_INTERVAL_MS && latest.title === snap.title) {
        return null;
      }
    }
  }

  const version = await prisma.pageVersion.create({
    data: {
      pageId: page.id,
      title: snap.title,
      content: snap.content || {},
      plainText: snap.plainText,
      createdById: user.id,
      createdByName: user.name || user.email,
    },
  });

  await trimOldVersions(page.id);
  return version;
}

export async function listPageVersions(pageId: string, limit = 50): Promise<PageVersionSummary[]> {
  const rows = await prisma.pageVersion.findMany({
    where: { pageId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      plainText: true,
      createdById: true,
      createdByName: true,
      createdAt: true,
    },
  });

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function getPageVersion(pageId: string, versionId: string) {
  return prisma.pageVersion.findFirst({
    where: { id: versionId, pageId },
  });
}

export async function restorePageVersion(
  pageId: string,
  versionId: string,
  user: Pick<User, "id" | "name" | "email">
) {
  const page = await prisma.page.findFirst({ where: { id: pageId } });
  if (!page) return null;

  const version = await getPageVersion(pageId, versionId);
  if (!version) return null;

  await snapshotPageBeforeUpdate(page, user, { force: true });

  const updated = await prisma.page.update({
    where: { id: pageId },
    data: {
      title: version.title,
      content: version.content!,
      plainText: version.plainText,
    },
  });

  return updated;
}
