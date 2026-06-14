import { getOpenAI, OPENAI_MODELS } from "@/lib/search/openai";
import { chargeUsage, gateUsage } from "@/lib/billing/metered-openai";

export async function embedText(text: string, userId?: string | null): Promise<number[]> {
  await gateUsage(userId);
  const openai = getOpenAI();
  const res = await openai.embeddings.create({
    model: OPENAI_MODELS.embedding,
    input: text.slice(0, 8000),
  });
  await chargeUsage(userId, res);
  return res.data[0].embedding;
}

export async function embedTexts(texts: string[], userId?: string | null): Promise<number[][]> {
  if (texts.length === 0) return [];
  await gateUsage(userId);
  const openai = getOpenAI();
  const res = await openai.embeddings.create({
    model: OPENAI_MODELS.embedding,
    input: texts.map((t) => t.slice(0, 8000)),
  });
  await chargeUsage(userId, res);
  return res.data.map((d) => d.embedding);
}

export function chunkText(text: string, size = 1000, overlap = 200): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  if (cleaned.length <= size) return [cleaned];

  const chunks: string[] = [];
  let start = 0;
  while (start < cleaned.length) {
    chunks.push(cleaned.slice(start, start + size));
    start += size - overlap;
  }
  return chunks;
}

export function embeddingToSql(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
