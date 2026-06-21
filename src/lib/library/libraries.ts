import { prisma } from "@/lib/db/prisma";
import { notDeleted } from "@/lib/db/filters";
import { getLibraryRole, requireLibraryAccess, type LibraryRole } from "@/lib/library/library-access";
import { DEFAULT_LIBRARY_ICON } from "@/lib/library/folder-colors";

export type LibrarySummary = {
  id: string;
  name: string;
  icon: string;
  userId: string;
  role: LibraryRole;
  isShared: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export async function listLibrariesWithRoles(userId: string): Promise<LibrarySummary[]> {
  await ensureDefaultLibrary(userId);

  const libraries = await prisma.library.findMany({
    where: {
      OR: [{ userId }, { members: { some: { userId } } }],
    },
    include: {
      members: {
        where: { userId },
        select: { role: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return libraries.map((library) => {
    const isOwner = library.userId === userId;
    const role: LibraryRole = isOwner ? "OWNER" : (library.members[0]?.role ?? "VIEWER");
    return {
      id: library.id,
      name: library.name,
      icon: library.icon,
      userId: library.userId,
      role,
      isShared: !isOwner,
      createdAt: library.createdAt,
      updatedAt: library.updatedAt,
    };
  });
}

export async function requireLibrary(userId: string, libraryId: string) {
  const { library } = await requireLibraryAccess(userId, libraryId, "VIEWER");
  return library;
}

export async function createLibrary(userId: string, name: string, icon = DEFAULT_LIBRARY_ICON) {
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
    data: { name: "My Library", icon: DEFAULT_LIBRARY_ICON, userId },
  });
}

export async function resolveLibraryId(
  userId: string,
  libraryId: string | null | undefined
): Promise<string> {
  if (libraryId) {
    const role = await getLibraryRole(userId, libraryId);
    if (!role) throw new Error("Library not found");
    return libraryId;
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
    where: { id: folderId, libraryId: fallbackLibraryId, ...notDeleted },
  });
  if (!folder) throw new Error("Folder not found");
  await requireLibraryAccess(userId, folder.libraryId, "VIEWER");
  return folder.libraryId;
}
