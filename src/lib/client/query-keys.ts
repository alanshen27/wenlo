/** Central TanStack Query keys for client-side server state. */
export const queryKeys = {
  me: ["me"] as const,
  libraries: ["libraries"] as const,
  libraryTree: (libraryId: string) => ["library-tree", libraryId] as const,
  libraryMembers: (libraryId: string) => ["library-members", libraryId] as const,
  page: (id: string) => ["page", id] as const,
  deck: (id: string) => ["deck", id] as const,
  board: (id: string) => ["board", id] as const,
  flowchart: (id: string) => ["flowchart", id] as const,
  database: (id: string) => ["database", id] as const,
  recallChat: (libraryId: string, scopeKey: string) =>
    ["recall-chat", libraryId, scopeKey] as const,
};
