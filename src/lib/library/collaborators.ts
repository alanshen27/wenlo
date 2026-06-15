import { prisma } from "@/lib/db/prisma";

export type Collaborator = {
  userId: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
};

/**
 * People (other than `selfId`) who can access each of the given libraries — the
 * owner plus every member. Used to render "shared with" avatars on cards. A
 * library with no one but the current user maps to an empty list.
 */
export async function listLibraryCollaborators(
  selfId: string,
  libraryIds: string[]
): Promise<Map<string, Collaborator[]>> {
  const result = new Map<string, Collaborator[]>();
  if (libraryIds.length === 0) return result;

  const libraries = await prisma.library.findMany({
    where: { id: { in: libraryIds } },
    select: {
      id: true,
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      members: {
        select: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      },
    },
  });

  for (const library of libraries) {
    const people = [library.user, ...library.members.map((m) => m.user)];
    const seen = new Set<string>();
    const collaborators: Collaborator[] = [];
    for (const person of people) {
      if (person.id === selfId || seen.has(person.id)) continue;
      seen.add(person.id);
      collaborators.push({
        userId: person.id,
        name: person.name,
        email: person.email,
        avatarUrl: person.avatarUrl,
      });
    }
    result.set(library.id, collaborators);
  }

  return result;
}
