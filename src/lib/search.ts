import { randomUUID } from "crypto";
import { prisma } from "./prisma";
import { chunkText, embedText, embedTexts, embeddingToSql } from "./embeddings";
import { Prisma } from "@prisma/client";

import type { RecallResult } from "./types";

export type { RecallResult } from "./types";

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

  const libraryFilter = libraryId
    ? Prisma.sql`AND (p."libraryId" = ${libraryId} OR d."libraryId" = ${libraryId})`
    : Prisma.empty;

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
      (p."userId" = ${userId} OR d."userId" = ${userId})
      AND (c.content ILIKE ${"%" + q + "%"} OR c.content % ${q})
    )
    ${libraryFilter}
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
        (p."userId" = ${userId} OR d."userId" = ${userId})
        AND c.content ILIKE ${"%" + q + "%"}
      )
      ${libraryFilter}
      ${folderFilter}
      LIMIT ${limit}
    `;
  });

  const results = new Map<string, RecallResult>();

  for (const row of keywordRows) {
    const key = `${row.source_type}-${row.source_id}`;
    results.set(key, {
      id: row.source_id,
      sourceType: row.source_type === "PAGE" ? "page" : "document",
      title: row.title,
      snippet: highlightSnippet(row.content, q),
      score: Number(row.rank) || 0.5,
      folderId: row.folder_id,
      matchType: "keyword",
    });
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
          (p."userId" = ${userId} OR d."userId" = ${userId})
          AND c.embedding IS NOT NULL
        )
        ${libraryFilter}
        ${folderFilter}
        ORDER BY distance ASC
        LIMIT ${limit}
      `;

      for (const row of semanticRows) {
        const key = `${row.source_type}-${row.source_id}`;
        const score = 1 - Number(row.distance);
        const existing = results.get(key);
        if (existing) {
          existing.score = Math.max(existing.score, score);
          existing.matchType = "both";
          if (score > existing.score) {
            existing.snippet = row.content.slice(0, 240) + "…";
          }
        } else if (score > 0.3) {
          results.set(key, {
            id: row.source_id,
            sourceType: row.source_type === "PAGE" ? "page" : "document",
            title: row.title,
            snippet: row.content.slice(0, 240) + "…",
            score,
            folderId: row.folder_id,
            matchType: "semantic",
          });
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
