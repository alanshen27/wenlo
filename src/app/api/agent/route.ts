import { NextRequest, NextResponse } from "next/server";
import type OpenAI from "openai";
import { withAuth } from "@/lib/api/http";
import { requireLibraryAccess } from "@/lib/library/library-access";
import type { User } from "@/generated/prisma/client";
import {
  appendRecallChatTurn,
  createRecallChatSession,
  getRecallChatSessionForUser,
  getRecallChatTurns,
  recallScopeKey,
  type RecallChatSessionSummary,
  type RecallTurn,
} from "@/lib/recall-chat/recall-chat";
import {
  formatToolCallBlock,
  formatToolResultBlock,
} from "@/lib/recall-chat/recall-tool-blocks";
import {
  collectStreamingToolCalls,
  executeRecallTool,
  finalizedToolCalls,
  MAX_AGENT_TOOL_ITERATIONS,
  RECALL_OPENAI_TOOLS,
  recallToolContextFromUser,
} from "@/lib/recall-chat/recall-tools";
import {
  buildRecallAgentSystemPrompt,
  formatRetrievedContext,
  recallRetrieve,
} from "@/lib/recall-chat/recall-retrieve";
import { getOpenAI, hasOpenAI, OPENAI_MODELS } from "@/lib/search/openai";
import { enforceRateLimit } from "@/lib/api/rate-limit";
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
  return withAuth(undefined, async ({ user }) => {
    await enforceRateLimit(user.id, user.plan, "agent");
    return handlePost(req, user);
  });
}

async function handlePost(req: NextRequest, user: User): Promise<Response> {
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

  await requireLibraryAccess(user.id, libraryId, "VIEWER");

  try {
    await assertWithinTokenLimit(user.id);
  } catch (error) {
    if (error instanceof UsageLimitError) {
      return NextResponse.json({ error: error.message, usage: error.usage }, { status: 429 });
    }
    throw error;
  }

  const scopeKey = recallScopeKey(scope, scope === "folder" ? folderId : null);
  const effectiveFolderId = scope === "folder" ? folderId : null;

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

  const results = await recallRetrieve({
    userId: user.id,
    query: question.trim(),
    libraryId,
    folderId: effectiveFolderId,
    limit: 12,
  });

  const scopeLabel =
    scope === "folder" && folderId ? "the selected folder" : "the current library";

  const hasResults = results.length > 0;
  const retrievedContext = formatRetrievedContext(results);

  const freshSearchNote =
    priorTurns.length > 0 && hasResults
      ? "Note: Fresh search + grep results are included below. Use them even if earlier turns found nothing.\n\n"
      : "";

  const openai = getOpenAI();
  const toolCtx = recallToolContextFromUser(user.id);
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

        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          {
            role: "system",
            content: buildRecallAgentSystemPrompt({
              scopeLabel,
              libraryId,
              folderId: effectiveFolderId,
              hasRetrievedExcerpts: hasResults,
            }),
          },
          ...priorTurns.flatMap((turn) => [
            { role: "user" as const, content: turn.question },
            { role: "assistant" as const, content: turn.answer },
          ]),
          {
            role: "user",
            content: `${freshSearchNote}Question: ${trimmedQuestion}\n\nRetrieved excerpts + grep hits (${results.length} source${results.length === 1 ? "" : "s"}):\n${retrievedContext}`,
          },
        ];

        let answer = "";
        let tokensUsed = 0;

        for (let iteration = 0; iteration < MAX_AGENT_TOOL_ITERATIONS; iteration++) {
          const completion = await openai.chat.completions.create({
            model: OPENAI_MODELS.chat,
            messages,
            tools: RECALL_OPENAI_TOOLS,
            stream: true,
            stream_options: { include_usage: true },
          });

          let iterationText = "";
          let toolCallAccum = new Map<
            number,
            { id: string; name: string; arguments: string }
          >();

          for await (const chunk of completion) {
            const choice = chunk.choices[0];
            const delta = choice?.delta;
            if (delta?.content) {
              iterationText += delta.content;
              answer += delta.content;
              send({ type: "delta", text: delta.content });
            }
            toolCallAccum = collectStreamingToolCalls(toolCallAccum, delta?.tool_calls);
            if (chunk.usage?.total_tokens) {
              tokensUsed = chunk.usage.total_tokens;
            }
          }

          const toolCalls = finalizedToolCalls(toolCallAccum);
          if (toolCalls.length === 0) break;

          messages.push({
            role: "assistant",
            content: iterationText || null,
            tool_calls: toolCalls.map((call) => ({
              id: call.id,
              type: "function" as const,
              function: {
                name: call.name,
                arguments: JSON.stringify(call.arguments),
              },
            })),
          });

          for (const call of toolCalls) {
            const callBlock = formatToolCallBlock({
              id: call.id,
              name: call.name,
              arguments: call.arguments,
            });
            answer += callBlock;
            send({ type: "delta", text: callBlock });

            const outcome = await executeRecallTool(call.name, call.arguments, toolCtx);
            const resultBlock = formatToolResultBlock({
              id: call.id,
              result: outcome.result,
              isError: outcome.isError,
            });
            answer += resultBlock;
            send({ type: "delta", text: resultBlock });

            messages.push({
              role: "tool",
              tool_call_id: call.id,
              content: JSON.stringify(
                outcome.isError ? { error: outcome.result } : outcome.result
              ),
            });
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

        const { session } = await appendRecallChatTurn(sessionIdForStream, user.id, turn);

        send({
          type: "done",
          sessionId: sessionIdForStream,
          session,
          turn,
        });
        controller.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Recall failed";
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
