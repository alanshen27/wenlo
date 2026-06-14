import { prisma } from "@/lib/db/prisma";

export type LibraryRole = "OWNER" | "EDITOR" | "VIEWER";

const ROLE_RANK: Record<LibraryRole, number> = {
  VIEWER: 1,
  EDITOR: 2,
  OWNER: 3,
};

export class LibraryAccessError extends Error {
  status: number;
  constructor(message: string, status = 404) {
    super(message);
    this.status = status;
  }
}

export function hasMinRole(role: LibraryRole, minRole: LibraryRole) {
  return ROLE_RANK[role] >= ROLE_RANK[minRole];
}

export async function getLibraryRole(
  userId: string,
  libraryId: string
): Promise<LibraryRole | null> {
  const library = await prisma.library.findUnique({
    where: { id: libraryId },
    select: { userId: true },
  });
  if (!library) return null;
  if (library.userId === userId) return "OWNER";

  const member = await prisma.libraryMember.findUnique({
    where: { libraryId_userId: { libraryId, userId } },
    select: { role: true },
  });
  if (!member) return null;
  return member.role;
}

export async function requireLibraryAccess(
  userId: string,
  libraryId: string,
  minRole: LibraryRole = "VIEWER"
) {
  const library = await prisma.library.findUnique({ where: { id: libraryId } });
  if (!library) throw new LibraryAccessError("Library not found", 404);

  if (library.userId === userId) {
    return { library, role: "OWNER" as const };
  }

  const member = await prisma.libraryMember.findUnique({
    where: { libraryId_userId: { libraryId, userId } },
  });
  if (!member) throw new LibraryAccessError("Library not found", 404);

  const role = member.role as "EDITOR" | "VIEWER";
  if (!hasMinRole(role, minRole)) {
    throw new LibraryAccessError("Forbidden", 403);
  }

  return { library, role };
}

export async function contentOwnerId(libraryId: string) {
  const library = await prisma.library.findUniqueOrThrow({
    where: { id: libraryId },
    select: { userId: true },
  });
  return library.userId;
}
