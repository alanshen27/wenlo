import type { RecallResult } from "@/lib/core/types";
import {
  extractGrepPatterns,
  grepLibraryFromQuestion,
  grepResultToRecallResult,
  mergeRecallResults,
} from "@/lib/search/grep";
import { recallSearch } from "@/lib/search/search";

export { extractGrepPatterns } from "@/lib/search/grep";

/** Semantic + keyword search combined with literal grep over source text. */
export async function recallRetrieve(opts: {
  userId: string;
  query: string;
  libraryId: string;
  folderId?: string | null;
  limit?: number;
}): Promise<RecallResult[]> {
  const limit = opts.limit ?? 12;
  const query = opts.query.trim();
  if (!query) return [];

  const [searchResults, grepFiles] = await Promise.all([
    recallSearch({
      userId: opts.userId,
      query,
      libraryId: opts.libraryId,
      folderId: opts.folderId,
      limit,
    }),
    grepLibraryFromQuestion({
      userId: opts.userId,
      libraryId: opts.libraryId,
      question: query,
      folderId: opts.folderId,
      limit,
    }),
  ]);

  return mergeRecallResults(
    [...searchResults, ...grepFiles.map(grepResultToRecallResult)],
    limit
  );
}

export function buildRecallAgentSystemPrompt(opts: {
  scopeLabel: string;
  libraryId: string;
  folderId?: string | null;
  hasRetrievedExcerpts: boolean;
}): string {
  return [
    `You are Recall, an AI assistant over the user's wenlo library (${opts.scopeLabel}).`,
    `Active library id: ${opts.libraryId}.`,
    opts.folderId ? `Active folder id: ${opts.folderId}.` : null,
    "You have the same tools as the wenlo MCP server, including search_library (semantic + keyword) and grep_library (exact literal/regex line search).",
    "Search carefully before answering:",
    "- Use grep_library for exact phrases, identifiers, function names, error strings, and quoted text.",
    "- Use search_library for conceptual or paraphrased questions.",
    "- Use get_document when you need the full text of a specific file or note.",
    "- If the first pass is weak, try alternate grep patterns or a broader search_library query before answering.",
    "Grounding rules (strict):",
    "- Only state facts supported by retrieved excerpts, grep hits, or tool results shown in this conversation.",
    "- Never invent sources, quotes, numbers, or document contents.",
    "- If the library does not contain enough evidence, say you could not find it — do not guess.",
    "- Cite source titles in brackets when using library material.",
    opts.hasRetrievedExcerpts
      ? "Initial retrieved excerpts and grep hits are in the user message. Treat them as starting evidence, not the complete library."
      : "No excerpts were retrieved for this question; search with tools before claiming anything exists.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function formatRetrievedContext(results: RecallResult[]): string {
  if (results.length === 0) return "(no matches found)";

  return results
    .map((result, index) => {
      const method =
        result.matchType === "grep"
          ? "GREP"
          : result.matchType === "semantic"
            ? "SEMANTIC"
            : result.matchType === "keyword"
              ? "KEYWORD"
              : "MIXED";
      return `[${index + 1}] ${method} · ${result.sourceType.toUpperCase()}: "${result.title}"\n${result.excerpt ?? result.snippet}`;
    })
    .join("\n\n");
}
