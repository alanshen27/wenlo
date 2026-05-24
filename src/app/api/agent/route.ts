import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { LibraryAccessError, requireLibraryAccess } from "@/lib/library-access";
import {
  appendRecallChatTurn,
  createRecallChatSession,
  getRecallChatSessionForUser,
  getRecallChatTurns,
  recallScopeKey,
  type RecallTurn,
} from "@/lib/recall-chat";
import { recallSearch } from "@/lib/search";
import { assertWithinTokenLimit, recordTokenUsage, UsageLimitError } from "@/lib/usage";

export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 503 });
  }

  const { question, folderId, libraryId, scope, sessionId } = await req.json();
  if (!question?.trim()) {
    return NextResponse.json({ error: "Question required" }, { status: 400 });
  }
  if (!libraryId) {
    return NextResponse.json({ error: "libraryId required" }, { status: 400 });
  }
  if (scope !== "all" && scope !== "folder") {
    return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
  }
  if (scope === "folder" && !folderId) {
    return NextResponse.json({ error: "folderId required for folder scope" }, { status: 400 });
  }

  try {
    await requireLibraryAccess(user.id, libraryId, "VIEWER");
  } catch (error) {
    if (error instanceof LibraryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  try {
    await assertWithinTokenLimit(user.id);
  } catch (error) {
    if (error instanceof UsageLimitError) {
      return NextResponse.json({ error: error.message, usage: error.usage }, { status: 429 });
    }
    throw error;
  }

  const scopeKey = recallScopeKey(scope, scope === "folder" ? folderId : null);

  let activeSessionId = typeof sessionId === "string" ? sessionId : null;
  if (activeSessionId) {
    const existing = await getRecallChatSessionForUser(user.id, activeSessionId);
    if (!existing || existing.libraryId !== libraryId || existing.scopeKey !== scopeKey) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
  } else {
    const created = await createRecallChatSession(user.id, libraryId, scopeKey);
    activeSessionId = created.id;
  }

  const priorTurns = await getRecallChatTurns(activeSessionId, user.id);

  const results = await recallSearch({
    userId: user.id,
    query: question.trim(),
    libraryId,
    folderId: scope === "folder" ? folderId : null,
    limit: 12,
  });

  const scopeLabel =
    scope === "folder" && folderId ? "the selected folder" : "the current library";

  const hasResults = results.length > 0;
  const retrievedContext = hasResults
    ? results
        .map(
          (r, i) =>
            `[${i + 1}] ${r.sourceType.toUpperCase()}: "${r.title}"\n${r.excerpt ?? r.snippet}`
        )
        .join("\n\n")
    : "(no matches found)";

  const freshSearchNote =
    priorTurns.length > 0 && hasResults
      ? "Note: Fresh search results are included below. Use them even if earlier turns found nothing.\n\n"
      : "";

  const { default: OpenAI } = await import("openai");
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: hasResults
          ? `You are recall, a personal knowledge assistant for ${scopeLabel}. Each user message may include retrieved excerpts from their notes and files. When excerpts are present, answer using that material and cite sources by title in brackets. Do not claim nothing was found when excerpts were retrieved.`
          : `You are recall, a personal knowledge assistant for ${scopeLabel}. If no excerpts were retrieved for a question, say you could not find relevant information in the library.`,
      },
      ...priorTurns.flatMap((turn) => [
        { role: "user" as const, content: turn.question },
        { role: "assistant" as const, content: turn.answer },
      ]),
      {
        role: "user",
        content: `${freshSearchNote}Question: ${question.trim()}\n\nRetrieved excerpts (${results.length} source${results.length === 1 ? "" : "s"}):\n${retrievedContext}`,
      },
    ],
    temperature: 0.3,
  });

  const tokensUsed = completion.usage?.total_tokens ?? 0;
  if (tokensUsed > 0) {
    await recordTokenUsage(user.id, tokensUsed);
  }

  const answer = completion.choices[0]?.message?.content ?? "";
  const turn: RecallTurn = {
    question: question.trim(),
    answer,
    sources: results,
    createdAt: new Date().toISOString(),
  };

  const { turns, title } = await appendRecallChatTurn(activeSessionId, user.id, turn);

  return NextResponse.json({
    sessionId: activeSessionId,
    session: {
      id: activeSessionId,
      title,
      turnCount: turns.length,
    },
    turn,
    turns,
    scope: scope === "folder" ? "folder" : "all",
  });
}
