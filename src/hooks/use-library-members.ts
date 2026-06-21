"use client";

import { useQuery } from "@tanstack/react-query";
import type { CollaboratorLike } from "@/components/cloud/collaborator-avatars";
import { apiGet } from "@/lib/client/api";
import { queryKeys } from "@/lib/client/query-keys";

type MembersResponse = {
  owner: { id: string; email: string; name: string | null; avatarUrl: string | null };
  currentUserId: string;
  members: { userId: string; email: string; name: string | null; avatarUrl: string | null }[];
};

/** Library collaborators for cloud view sharing UI (excludes current user). */
export function useLibraryMembers(libraryId: string) {
  return useQuery({
    queryKey: queryKeys.libraryMembers(libraryId),
    queryFn: async () => {
      const data = await apiGet<MembersResponse>(`/api/libraries/${libraryId}/members`);
      const seen = new Set<string>();
      const list: CollaboratorLike[] = [];

      const push = (p: {
        id: string;
        name: string | null;
        email: string;
        avatarUrl: string | null;
      }) => {
        if (p.id === data.currentUserId || seen.has(p.id)) return;
        seen.add(p.id);
        list.push({ userId: p.id, name: p.name, email: p.email, avatarUrl: p.avatarUrl });
      };

      push(data.owner);
      for (const m of data.members) {
        push({ id: m.userId, name: m.name, email: m.email, avatarUrl: m.avatarUrl });
      }
      return list;
    },
    enabled: Boolean(libraryId),
    meta: { errorMessage: "Couldn't load collaborators" },
  });
}
