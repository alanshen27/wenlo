import { prisma } from "./prisma";

const ACTIVE_MS = 25_000;

export type PageCollaborator = {
  userId: string;
  name: string | null;
  email: string;
};

export async function touchPagePresence(
  pageId: string,
  user: { id: string; email: string; name: string | null }
) {
  return prisma.pagePresence.upsert({
    where: { pageId_userId: { pageId, userId: user.id } },
    create: {
      pageId,
      userId: user.id,
      email: user.email,
      name: user.name,
    },
    update: {
      email: user.email,
      name: user.name,
      lastSeen: new Date(),
    },
  });
}

export async function listPageCollaborators(
  pageId: string,
  excludeUserId?: string
): Promise<PageCollaborator[]> {
  const cutoff = new Date(Date.now() - ACTIVE_MS);
  const rows = await prisma.pagePresence.findMany({
    where: {
      pageId,
      lastSeen: { gte: cutoff },
      ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
    },
    orderBy: { lastSeen: "desc" },
  });

  return rows.map((row) => ({
    userId: row.userId,
    name: row.name,
    email: row.email,
  }));
}

export async function leavePagePresence(pageId: string, userId: string) {
  await prisma.pagePresence.deleteMany({ where: { pageId, userId } });
}
