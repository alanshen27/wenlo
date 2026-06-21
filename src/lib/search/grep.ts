import { prisma } from "@/lib/db/prisma";
import { getLibraryRole } from "@/lib/library/library-access";
import {
  extractGrepPatterns,
  grepResultToRecallResult,
  grepTextSources,
  type GrepFileResult,
} from "@/lib/search/grep-utils";

export {
  extractGrepPatterns,
  findLineMatches,
  grepResultToRecallResult,
  mergeRecallResults,
  type GrepFileResult,
  type GrepLineMatch,
} from "@/lib/search/grep-utils";

/** Literal / regex grep across page plain text and document bodies. */
export async function grepLibrary(opts: {
  userId: string;
  libraryId: string;
  pattern: string;
  folderId?: string | null;
  caseSensitive?: boolean;
  regex?: boolean;
  limit?: number;
  contextLines?: number;
  maxMatchesPerFile?: number;
}): Promise<GrepFileResult[]> {
  const pattern = opts.pattern.trim();
  if (!pattern) return [];

  const role = await getLibraryRole(opts.userId, opts.libraryId);
  if (!role) return [];

  const folderFilter = opts.folderId ? { folderId: opts.folderId } : {};
  const sourceLimit = Math.min((opts.limit ?? 20) * 3, 120);
  const caseMode = opts.caseSensitive ? ("default" as const) : ("insensitive" as const);
  const textFilter = opts.regex
    ? {}
    : {
        OR: [
          { plainText: { contains: pattern, mode: caseMode } },
          { title: { contains: pattern, mode: caseMode } },
        ],
      };
  const docTextFilter = opts.regex
    ? {}
    : {
        OR: [
          { content: { contains: pattern, mode: caseMode } },
          { title: { contains: pattern, mode: caseMode } },
        ],
      };

  const [pages, documents] = await Promise.all([
    prisma.page.findMany({
      where: { libraryId: opts.libraryId, ...folderFilter, plainText: { not: "" }, ...textFilter },
      select: { id: true, title: true, plainText: true, folderId: true },
      take: sourceLimit,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.document.findMany({
      where: {
        libraryId: opts.libraryId,
        ...folderFilter,
        content: { not: "" },
        storagePath: null,
        ...docTextFilter,
      },
      select: { id: true, title: true, content: true, folderId: true },
      take: sourceLimit,
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const sources = [
    ...pages.map((page) => ({
      id: page.id,
      sourceType: "page" as const,
      title: page.title,
      folderId: page.folderId,
      text: page.plainText,
    })),
    ...documents.map((doc) => ({
      id: doc.id,
      sourceType: "document" as const,
      title: doc.title,
      folderId: doc.folderId,
      text: doc.content,
    })),
  ];

  return grepTextSources(opts, sources);
}

export async function grepLibraryFromQuestion(opts: {
  userId: string;
  libraryId: string;
  question: string;
  folderId?: string | null;
  limit?: number;
}): Promise<GrepFileResult[]> {
  const patterns = extractGrepPatterns(opts.question);
  if (patterns.length === 0) return [];

  const perPattern = Math.max(4, Math.ceil((opts.limit ?? 12) / patterns.length));
  const batches = await Promise.all(
    patterns.map((pattern) =>
      grepLibrary({
        userId: opts.userId,
        libraryId: opts.libraryId,
        folderId: opts.folderId,
        pattern,
        limit: perPattern,
      })
    )
  );

  const merged = new Map<string, GrepFileResult>();
  for (const batch of batches) {
    for (const item of batch) {
      const key = `${item.sourceType}-${item.id}`;
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, item);
        continue;
      }
      existing.matchCount += item.matchCount;
      const seen = new Set(existing.matches.map((m) => m.lineNumber));
      for (const match of item.matches) {
        if (!seen.has(match.lineNumber)) existing.matches.push(match);
      }
      existing.matches.sort((a, b) => a.lineNumber - b.lineNumber);
    }
  }

  return [...merged.values()]
    .sort((a, b) => b.matchCount - a.matchCount)
    .slice(0, opts.limit ?? 12);
}
