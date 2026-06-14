import { randomUUID } from "crypto";
import { prisma } from "./prisma";
import { chunkText, embedText, embedTexts, embeddingToSql } from "./embeddings";
import { Prisma } from "@/generated/prisma/client";
import { getLibraryRole } from "./library-access";

import type { RecallResult } from "./types";

export type { RecallResult } from "./types";

const EXCERPT_MAX = 1200;

function isUsefulChunk(content: string, title: string): boolean {
  const trimmed = content.replace(/\s+/g, " ").trim();
  if (trimmed.length < 20) return false;
  const normalizedTitle = title.replace(/\s+/g, " ").trim();
  if (trimmed === normalizedTitle || trimmed === "Untitled") return false;
  return true;
}

function buildExcerpt(content: string, query: string): string {
  const highlighted = highlightSnippet(content, query, 400);
  const body =
    highlighted.length >= 60
      ? highlighted
      : content.slice(0, EXCERPT_MAX) + (content.length > EXCERPT_MAX ? "…" : "");
  return body.slice(0, EXCERPT_MAX);
}

function upsertSearchResult(
  results: Map<string, RecallResult>,
  row: {
    source_type: string;
    source_id: string;
    title: string;
    content: string;
    folder_id: string | null;
  },
  query: string,
  score: number,
  matchType: "keyword" | "semantic"
) {
  if (!isUsefulChunk(row.content, row.title)) return;

  const key = `${row.source_type}-${row.source_id}`;
  const existing = results.get(key);
  const next: RecallResult = {
    id: row.source_id,
    sourceType: row.source_type === "PAGE" ? "page" : "document",
    title: row.title,
    snippet: highlightSnippet(row.content, query),
    excerpt: buildExcerpt(row.content, query),
    score,
    folderId: row.folder_id,
    matchType: existing && existing.matchType !== matchType ? "both" : matchType,
  };

  if (!existing || score >= existing.score) {
    results.set(key, next);
  } else if (existing.matchType !== matchType) {
    existing.matchType = "both";
    existing.score = Math.max(existing.score, score);
  }
}

/** Chunks belong to libraries; members must see owner-uploaded content too. */
function libraryAccessFilter(userId: string, libraryId?: string | null): Prisma.Sql {
  if (libraryId) {
    return Prisma.sql`COALESCE(p."libraryId", d."libraryId") = ${libraryId}`;
  }
  return Prisma.sql`COALESCE(p."libraryId", d."libraryId") IN (
    SELECT l.id FROM "Library" l
    LEFT JOIN "LibraryMember" m ON m."libraryId" = l.id AND m."userId" = ${userId}
    WHERE l."userId" = ${userId} OR m."userId" IS NOT NULL
  )`;
}

function highlightSnippet(content: string, query: string, radius = 120): string {
  const lower = content.toLowerCase();
  const q = query.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) return content.slice(0, radius * 2) + (content.length > radius * 2 ? "…" : "");
  const start = Math.max(0, idx - radius);
  const end = Math.min(content.length, idx + query.length + radius);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < content.length ? "…" : "";
  return prefix + content.slice(start, end) + suffix;
}

export async function recallSearch(opts: {
  userId: string;
  query: string;
  libraryId?: string | null;
  folderId?: string | null;
  limit?: number;
}): Promise<RecallResult[]> {
  const { userId, query, libraryId, folderId, limit = 20 } = opts;
  const q = query.trim();
  if (!q) return [];

  if (libraryId) {
    const role = await getLibraryRole(userId, libraryId);
    if (!role) return [];
  }

  const accessFilter = libraryAccessFilter(userId, libraryId);

  const folderFilter = folderId
    ? Prisma.sql`AND (
        (c."pageId" IS NOT NULL AND p."folderId" = ${folderId})
        OR (c."documentId" IS NOT NULL AND d."folderId" = ${folderId})
      )`
    : Prisma.empty;

  // Full-text keyword search via ILIKE on chunks
  const keywordRows = await prisma.$queryRaw<
    Array<{
      chunk_id: string;
      source_type: string;
      source_id: string;
      title: string;
      content: string;
      folder_id: string | null;
      rank: number;
    }>
  >`
    SELECT
      c.id AS chunk_id,
      c."sourceType" AS source_type,
      COALESCE(c."pageId", c."documentId") AS source_id,
      COALESCE(p.title, d.title) AS title,
      c.content,
      COALESCE(p."folderId", d."folderId") AS folder_id,
      similarity(c.content, ${q}) AS rank
    FROM "Chunk" c
    LEFT JOIN "Page" p ON c."pageId" = p.id
    LEFT JOIN "Document" d ON c."documentId" = d.id
    WHERE (
      ${accessFilter}
      AND (
        c.content ILIKE ${"%" + q + "%"}
        OR c.content % ${q}
        OR COALESCE(p.title, d.title) ILIKE ${"%" + q + "%"}
      )
    )
    ${folderFilter}
    ORDER BY rank DESC
    LIMIT ${limit}
  `.catch(async () => {
    // Fallback if pg_trgm not enabled
    return prisma.$queryRaw<
      Array<{
        chunk_id: string;
        source_type: string;
        source_id: string;
        title: string;
        content: string;
        folder_id: string | null;
        rank: number;
      }>
    >`
      SELECT
        c.id AS chunk_id,
        c."sourceType" AS source_type,
        COALESCE(c."pageId", c."documentId") AS source_id,
        COALESCE(p.title, d.title) AS title,
        c.content,
        COALESCE(p."folderId", d."folderId") AS folder_id,
        1.0 AS rank
      FROM "Chunk" c
      LEFT JOIN "Page" p ON c."pageId" = p.id
      LEFT JOIN "Document" d ON c."documentId" = d.id
      WHERE (
        ${accessFilter}
        AND (
          c.content ILIKE ${"%" + q + "%"}
          OR COALESCE(p.title, d.title) ILIKE ${"%" + q + "%"}
        )
      )
      ${folderFilter}
      LIMIT ${limit}
    `;
  });

  const results = new Map<string, RecallResult>();

  for (const row of keywordRows) {
    upsertSearchResult(results, row, q, Number(row.rank) || 0.5, "keyword");
  }

  // Semantic search via pgvector
  if (process.env.OPENAI_API_KEY) {
    try {
      const embedding = await embedText(q);
      const vec = embeddingToSql(embedding);

      const semanticRows = await prisma.$queryRaw<
        Array<{
          chunk_id: string;
          source_type: string;
          source_id: string;
          title: string;
          content: string;
          folder_id: string | null;
          distance: number;
        }>
      >`
        SELECT
          c.id AS chunk_id,
          c."sourceType" AS source_type,
          COALESCE(c."pageId", c."documentId") AS source_id,
          COALESCE(p.title, d.title) AS title,
          c.content,
          COALESCE(p."folderId", d."folderId") AS folder_id,
          (c.embedding <=> ${vec}::vector) AS distance
        FROM "Chunk" c
        LEFT JOIN "Page" p ON c."pageId" = p.id
        LEFT JOIN "Document" d ON c."documentId" = d.id
        WHERE (
          ${accessFilter}
          AND c.embedding IS NOT NULL
        )
        ${folderFilter}
        ORDER BY distance ASC
        LIMIT ${limit}
      `;

      for (const row of semanticRows) {
        const score = 1 - Number(row.distance);
        if (score > 0.3) {
          upsertSearchResult(results, row, q, score, "semantic");
        }
      }
    } catch {
      // Embeddings unavailable — keyword results only
    }
  }

  return Array.from(results.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function indexPage(pageId: string, title: string, plainText: string) {
  await prisma.chunk.deleteMany({ where: { pageId } });
  const chunks = chunkText(`${title}\n\n${plainText}`);
  if (chunks.length === 0) return;

  let embeddings: number[][] = [];
  if (process.env.OPENAI_API_KEY) {
    try {
      embeddings = await embedTexts(chunks);
    } catch {
      embeddings = [];
    }
  }

  for (let i = 0; i < chunks.length; i++) {
    const embedding = embeddings[i];
    if (embedding) {
      await prisma.$executeRaw`
        INSERT INTO "Chunk" (id, "sourceType", "pageId", content, "chunkIndex", embedding, "createdAt")
        VALUES (
          ${randomUUID()},
          'PAGE'::"ChunkSourceType",
          ${pageId},
          ${chunks[i]},
          ${i},
          ${embeddingToSql(embedding)}::vector,
          NOW()
        )
      `;
    } else {
      await prisma.chunk.create({
        data: {
          sourceType: "PAGE",
          pageId,
          content: chunks[i],
          chunkIndex: i,
        },
      });
    }
  }
}

export async function indexDocument(documentId: string, title: string, content: string) {
  await prisma.chunk.deleteMany({ where: { documentId } });
  const chunks = chunkText(`${title}\n\n${content}`);
  if (chunks.length === 0) return;

  let embeddings: number[][] = [];
  if (process.env.OPENAI_API_KEY) {
    try {
      embeddings = await embedTexts(chunks);
    } catch {
      embeddings = [];
    }
  }

  for (let i = 0; i < chunks.length; i++) {
    const embedding = embeddings[i];
    if (embedding) {
      await prisma.$executeRaw`
        INSERT INTO "Chunk" (id, "sourceType", "documentId", content, "chunkIndex", embedding, "createdAt")
        VALUES (
          ${randomUUID()},
          'DOCUMENT'::"ChunkSourceType",
          ${documentId},
          ${chunks[i]},
          ${i},
          ${embeddingToSql(embedding)}::vector,
          NOW()
        )
      `;
    } else {
      await prisma.chunk.create({
        data: {
          sourceType: "DOCUMENT",
          documentId,
          content: chunks[i],
          chunkIndex: i,
        },
      });
    }
  }
}
