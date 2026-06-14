import type { RecallResult } from "@/lib/types";

/**
 * Client-safe Recall chat helpers and types. Kept separate from `recall-chat.ts`
 * (which imports Prisma) so client components can use these without pulling the
 * server-only database client into the browser bundle.
 */

export type RecallTurn = {
  question: string;
  answer: string;
  sources: RecallResult[];
  createdAt: string;
};

export type RecallChatSessionSummary = {
  id: string;
  title: string | null;
  turnCount: number;
  updatedAt: string;
  createdAt: string;
};

export const MAX_RECALL_TURNS = 50;

export function recallScopeKey(scope: "all" | "folder", folderId: string | null): string {
  if (scope === "folder" && folderId) return `folder:${folderId}`;
  return "library";
}

export function recallChatQuery(scope: "all" | "folder", folderId: string | null) {
  const params = new URLSearchParams({ scope });
  if (scope === "folder" && folderId) params.set("folderId", folderId);
  return params.toString();
}
