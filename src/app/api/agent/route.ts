import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { recallSearch } from "@/lib/search";
import { assertWithinTokenLimit, recordTokenUsage, UsageLimitError } from "@/lib/usage";

export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 503 });
  }

  const { question, folderId, libraryId, scope } = await req.json();
  if (!question?.trim()) {
    return NextResponse.json({ error: "Question required" }, { status: 400 });
  }

  try {
    await assertWithinTokenLimit(user.id);
  } catch (error) {
    if (error instanceof UsageLimitError) {
      return NextResponse.json({ error: error.message, usage: error.usage }, { status: 429 });
    }
    throw error;
  }

  const results = await recallSearch({
    userId: user.id,
    query: question.trim(),
    libraryId: libraryId || null,
    folderId: scope === "folder" ? folderId : null,
    limit: 12,
  });

  const context = results
    .map(
      (r, i) =>
        `[${i + 1}] ${r.sourceType.toUpperCase()}: "${r.title}"\n${r.snippet}\n(match: ${r.matchType}, score: ${r.score.toFixed(2)})`
    )
    .join("\n\n");

  const scopeLabel =
    scope === "folder" && folderId
      ? "the selected folder"
      : "the current library";

  const { default: OpenAI } = await import("openai");
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are recall, a personal knowledge assistant. Answer using ONLY the retrieved context from ${scopeLabel}. Cite sources by title in brackets. If context is insufficient, say so.`,
      },
      {
        role: "user",
        content: `Question: ${question.trim()}\n\nRetrieved context:\n${context || "(no matches found)"}`,
      },
    ],
    temperature: 0.3,
  });

  const tokensUsed = completion.usage?.total_tokens ?? 0;
  if (tokensUsed > 0) {
    await recordTokenUsage(user.id, tokensUsed);
  }

  return NextResponse.json({
    answer: completion.choices[0]?.message?.content ?? "",
    sources: results,
    scope: scope === "folder" ? "folder" : "all",
  });
}
