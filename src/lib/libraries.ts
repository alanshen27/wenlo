import { prisma } from "./prisma";

export async function listLibraries(userId: string) {
  await ensureDefaultLibrary(userId);
  return prisma.library.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

export async function requireLibrary(userId: string, libraryId: string) {
  const library = await prisma.library.findFirst({
    where: { id: libraryId, userId },
  });
  if (!library) throw new Error("Library not found");
  return library;
}

export async function createLibrary(userId: string, name: string, icon = "📚") {
  return prisma.library.create({
    data: { name: name.trim(), icon, userId },
  });
}

async function ensureDefaultLibrary(userId: string) {
  const existing = await prisma.library.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;

  return prisma.library.create({
    data: { name: "My Library", icon: "📚", userId },
  });
}

export async function resolveLibraryId(
  userId: string,
  libraryId: string | null | undefined
): Promise<string> {
  if (libraryId) {
    const library = await requireLibrary(userId, libraryId);
    return library.id;
  }
  const library = await ensureDefaultLibrary(userId);
  return library.id;
}

export async function libraryIdFromFolder(
  userId: string,
  folderId: string | null | undefined,
  fallbackLibraryId: string
): Promise<string> {
  if (!folderId || folderId === "__root__") return fallbackLibraryId;
  const folder = await prisma.folder.findFirst({
    where: { id: folderId, userId },
  });
  return folder?.libraryId ?? fallbackLibraryId;
}
