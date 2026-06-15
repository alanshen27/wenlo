import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/auth";
import { LibraryAccessError, requireLibraryAccess } from "@/lib/library/library-access";
import {
  appendRecallChatTurn,
  createRecallChatSession,
  getRecallChatSessionForUser,
  getRecallChatTurns,
  recallScopeKey,
  type RecallChatSessionSummary,
  type RecallTurn,
} from "@/lib/recall-chat/recall-chat";
import { getOpenAI, hasOpenAI, OPENAI_MODELS } from "@/lib/search/openai";
import { recallSearch } from "@/lib/search/search";
import { assertWithinTokenLimit, recordTokenUsage, UsageLimitError } from "@/lib/billing/usage";

type AgentStreamEvent =
  | {
      type: "meta";
      sessionId: string;
      sources: RecallTurn["sources"];
      scope: "all" | "folder";
    }
  | { type: "delta"; text: string }
  | {
      type: "done";
      sessionId: string;
      session: RecallChatSessionSummary;
      turn: RecallTurn;
    }
  | { type: "error"; error: string };

export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasOpenAI()) {
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

  const openai = getOpenAI();

  const sessionIdForStream: string = activeSessionId;
  const trimmedQuestion = question.trim();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AgentStreamEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        send({
          type: "meta",
          sessionId: sessionIdForStream,
          sources: results,
          scope: scope === "folder" ? "folder" : "all",
        });

        const completion = await openai.chat.completions.create({
          model: OPENAI_MODELS.chat,
          stream: true,
          stream_options: { include_usage: true },
          messages: [
            {
              role: "system",
              content: hasResults
                ? `You are Recall, an AI assistant that answers over the files and notes stored in ${scopeLabel}. Each user message may include retrieved excerpts from their files and notes. When excerpts are present, answer using that material and cite sources by title in brackets. Do not claim nothing was found when excerpts were retrieved.`
                : `You are Recall, an AI assistant that answers over the files and notes stored in ${scopeLabel}. If no excerpts were retrieved for a question, say you could not find relevant information in the library.`,
            },
            ...priorTurns.flatMap((turn) => [
              { role: "user" as const, content: turn.question },
              { role: "assistant" as const, content: turn.answer },
            ]),
            {
              role: "user",
              content: `${freshSearchNote}Question: ${trimmedQuestion}\n\nRetrieved excerpts (${results.length} source${results.length === 1 ? "" : "s"}):\n${retrievedContext}`,
            },
          ],
        });

        let answer = "";
        let tokensUsed = 0;
        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            answer += delta;
            send({ type: "delta", text: delta });
          }
          if (chunk.usage?.total_tokens) {
            tokensUsed = chunk.usage.total_tokens;
          }
        }

        if (tokensUsed > 0) {
          await recordTokenUsage(user.id, tokensUsed);
        }

        const turn: RecallTurn = {
          question: trimmedQuestion,
          answer,
          sources: results,
          createdAt: new Date().toISOString(),
        };

        const { session } = await appendRecallChatTurn(
          sessionIdForStream,
          user.id,
          turn
        );

        send({
          type: "done",
          sessionId: sessionIdForStream,
          session,
          turn,
        });
        controller.close();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Recall failed";
        send({ type: "error", error: message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
