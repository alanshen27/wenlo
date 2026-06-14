import OpenAI from "openai";

/**
 * Centralized OpenAI configuration. Edit these constants to change the models
 * used across the app (chat answers, embeddings, and file/image processing).
 * Each can be overridden per-environment without code changes.
 */
export const OPENAI_MODELS = {
  /** Recall chat / agent answers. */
  chat: process.env.OPENAI_CHAT_MODEL ?? "gpt-5.5",
  /** Text embeddings for RAG indexing + search (must match the pgvector dim). */
  embedding: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
  /** Vision + file understanding for images, scanned PDFs, and misc files. */
  fileProcessing: process.env.OPENAI_FILE_MODEL ?? "gpt-5.5",
} as const;

/** Embedding vector size — must match the `vector(N)` column on `Chunk`. */
export const EMBEDDING_DIMENSIONS = 1536;

/**
 * Whether to run images / scanned PDFs / unsupported binaries through the
 * OpenAI file-processing model to extract searchable text. On by default;
 * set `OPENAI_FILE_PROCESSING=false` to disable.
 */
export const OPENAI_FILE_PROCESSING_ENABLED =
  process.env.OPENAI_FILE_PROCESSING !== "false";

/** True when an API key is configured (callers can degrade gracefully). */
export function hasOpenAI(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

let cachedClient: OpenAI | null = null;

/** Shared OpenAI client. Throws if `OPENAI_API_KEY` is not set. */
export function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
  cachedClient ??= new OpenAI({ apiKey });
  return cachedClient;
}
