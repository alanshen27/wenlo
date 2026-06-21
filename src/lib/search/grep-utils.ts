import type { RecallResult } from "@/lib/core/types";

export type GrepLineMatch = {
  lineNumber: number;
  line: string;
  before: string[];
  after: string[];
};

export type GrepFileResult = {
  id: string;
  sourceType: "page" | "document";
  title: string;
  folderId: string | null;
  pattern: string;
  matchCount: number;
  matches: GrepLineMatch[];
};

const GREP_STOP_WORDS = new Set([
  "about",
  "after",
  "also",
  "and",
  "are",
  "been",
  "before",
  "does",
  "from",
  "have",
  "that",
  "the",
  "this",
  "what",
  "when",
  "where",
  "which",
  "with",
  "your",
]);

/** Pull quoted phrases and salient terms from a question for automatic grep. */
export function extractGrepPatterns(query: string): string[] {
  const patterns = new Set<string>();

  for (const match of query.matchAll(/"([^"]+)"|'([^']+)'|`([^`]+)`/g)) {
    const phrase = (match[1] ?? match[2] ?? match[3])?.trim();
    if (phrase && phrase.length >= 2) patterns.add(phrase);
  }

  for (const token of query.match(/\b[A-Za-z0-9][A-Za-z0-9_.-]{2,}\b/g) ?? []) {
    const lower = token.toLowerCase();
    if (GREP_STOP_WORDS.has(lower)) continue;
    if (/^\d+$/.test(token)) continue;
    patterns.add(token);
  }

  const trimmed = query.trim();
  if (patterns.size === 0 && trimmed.length >= 3 && trimmed.length <= 80) {
    patterns.add(trimmed);
  }

  return [...patterns]
    .sort((a, b) => b.length - a.length)
    .slice(0, 4);
}

function lineMatches(
  line: string,
  pattern: string,
  caseSensitive: boolean,
  regex: boolean
): boolean {
  if (!pattern) return false;
  if (regex) {
    try {
      return new RegExp(pattern, caseSensitive ? "" : "i").test(line);
    } catch {
      return false;
    }
  }
  return caseSensitive
    ? line.includes(pattern)
    : line.toLowerCase().includes(pattern.toLowerCase());
}

export function findLineMatches(
  text: string,
  pattern: string,
  options?: {
    caseSensitive?: boolean;
    regex?: boolean;
    contextLines?: number;
    maxMatches?: number;
  }
): GrepLineMatch[] {
  const contextLines = options?.contextLines ?? 1;
  const maxMatches = options?.maxMatches ?? 20;
  const lines = text.split(/\r?\n/);
  const hits: GrepLineMatch[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (!lineMatches(lines[i], pattern, options?.caseSensitive ?? false, options?.regex ?? false)) {
      continue;
    }
    hits.push({
      lineNumber: i + 1,
      line: lines[i],
      before: lines.slice(Math.max(0, i - contextLines), i),
      after: lines.slice(i + 1, Math.min(lines.length, i + 1 + contextLines)),
    });
    if (hits.length >= maxMatches) break;
  }

  return hits;
}

function formatGrepExcerpt(result: GrepFileResult): string {
  return result.matches
    .map((match) => {
      const before = match.before.map((line) => `  ${line}`).join("\n");
      const after = match.after.map((line) => `  ${line}`).join("\n");
      return [
        before,
        `> L${match.lineNumber}: ${match.line}`,
        after,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n")
    .slice(0, 1200);
}

export function grepResultToRecallResult(result: GrepFileResult): RecallResult {
  const first = result.matches[0];
  return {
    id: result.id,
    sourceType: result.sourceType,
    title: result.title,
    snippet: first ? `L${first.lineNumber}: ${first.line}` : "",
    excerpt: formatGrepExcerpt(result),
    score: result.matchCount,
    folderId: result.folderId,
    matchType: "grep",
  };
}

export function mergeRecallResults(results: RecallResult[], limit: number): RecallResult[] {
  const merged = new Map<string, RecallResult>();

  for (const item of results) {
    const key = `${item.sourceType}-${item.id}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...item });
      continue;
    }

    existing.score = Math.max(existing.score, item.score);
    if (existing.matchType !== item.matchType) {
      existing.matchType = "both";
    }
    if ((item.excerpt?.length ?? 0) > (existing.excerpt?.length ?? 0)) {
      existing.excerpt = item.excerpt;
      existing.snippet = item.snippet;
    }
  }

  return [...merged.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

export async function grepTextSources(
  opts: {
    pattern: string;
    caseSensitive?: boolean;
    regex?: boolean;
    limit?: number;
    contextLines?: number;
    maxMatchesPerFile?: number;
  },
  sources: Array<{
    id: string;
    sourceType: "page" | "document";
    title: string;
    folderId: string | null;
    text: string;
  }>
): Promise<GrepFileResult[]> {
  const limit = opts.limit ?? 20;
  const results: GrepFileResult[] = [];

  for (const source of sources) {
    const matches = findLineMatches(source.text, opts.pattern, {
      caseSensitive: opts.caseSensitive,
      regex: opts.regex,
      contextLines: opts.contextLines ?? 1,
      maxMatches: opts.maxMatchesPerFile ?? 8,
    });
    if (matches.length === 0) continue;
    results.push({
      id: source.id,
      sourceType: source.sourceType,
      title: source.title,
      folderId: source.folderId,
      pattern: opts.pattern,
      matchCount: matches.length,
      matches,
    });
    if (results.length >= limit) break;
  }

  return results.sort((a, b) => b.matchCount - a.matchCount);
}
