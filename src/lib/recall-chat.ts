import type { RecallResult } from "@/lib/types";
import { prisma } from "@/lib/prisma";

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

function parseTurns(raw: unknown): RecallTurn[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (turn): turn is RecallTurn =>
      !!turn &&
      typeof turn === "object" &&
      typeof (turn as RecallTurn).question === "string" &&
      typeof (turn as RecallTurn).answer === "string" &&
      Array.isArray((turn as RecallTurn).sources) &&
      typeof (turn as RecallTurn).createdAt === "string"
  );
}

function titleFromQuestion(question: string): string {
  const trimmed = question.trim().replace(/\s+/g, " ");
  if (!trimmed) return "New chat";
  return trimmed.length <= 60 ? trimmed : `${trimmed.slice(0, 57)}…`;
}

function toSummary(session: {
  id: string;
  title: string | null;
  turns: unknown;
  updatedAt: Date;
  createdAt: Date;
}): RecallChatSessionSummary {
  return {
    id: session.id,
    title: session.title,
    turnCount: parseTurns(session.turns).length,
    updatedAt: session.updatedAt.toISOString(),
    createdAt: session.createdAt.toISOString(),
  };
}

export async function listRecallChatSessions(
  userId: string,
  libraryId: string,
  scopeKey: string
): Promise<RecallChatSessionSummary[]> {
  const sessions = await prisma.recallChatSession.findMany({
    where: { userId, libraryId, scopeKey },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, turns: true, updatedAt: true, createdAt: true },
  });
  return sessions.map(toSummary);
}

export async function createRecallChatSession(
  userId: string,
  libraryId: string,
  scopeKey: string
): Promise<RecallChatSessionSummary> {
  const session = await prisma.recallChatSession.create({
    data: { userId, libraryId, scopeKey },
    select: { id: true, title: true, turns: true, updatedAt: true, createdAt: true },
  });
  return toSummary(session);
}

export async function getRecallChatSessionForUser(userId: string, sessionId: string) {
  return prisma.recallChatSession.findFirst({
    where: { id: sessionId, userId },
  });
}

export async function getRecallChatTurns(sessionId: string, userId: string): Promise<RecallTurn[]> {
  const session = await getRecallChatSessionForUser(userId, sessionId);
  if (!session) return [];
  return parseTurns(session.turns);
}

export async function appendRecallChatTurn(
  sessionId: string,
  userId: string,
  turn: RecallTurn
): Promise<{ turns: RecallTurn[]; title: string | null }> {
  const session = await getRecallChatSessionForUser(userId, sessionId);
  if (!session) throw new Error("Session not found");

  const existing = parseTurns(session.turns);
  const turns = [...existing, turn].slice(-MAX_RECALL_TURNS);
  const title = session.title ?? titleFromQuestion(turn.question);

  await prisma.recallChatSession.update({
    where: { id: sessionId },
    data: { turns, title },
  });

  return { turns, title };
}

export async function deleteRecallChatSession(userId: string, sessionId: string): Promise<boolean> {
  const result = await prisma.recallChatSession.deleteMany({
    where: { id: sessionId, userId },
  });
  return result.count > 0;
}
