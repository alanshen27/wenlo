import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export const DOCUMENTS_BUCKET = "documents";

/**
 * Supabase Storage rejects object keys containing characters outside a safe
 * set (e.g. the U+202F narrow no-break space macOS puts in screenshot names,
 * other Unicode, or odd punctuation), failing with "Invalid key". Collapse the
 * filename to a safe ASCII subset for the storage key — the human-readable
 * name is kept separately as the document title.
 */
export function sanitizeStorageName(name: string): string {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return cleaned || "file";
}

function isBucketMissing(error: { message?: string } | null): boolean {
  const message = error?.message?.toLowerCase() ?? "";
  return message.includes("bucket not found") || message.includes("not found");
}

async function ensureBucket(supabase: SupabaseClient): Promise<void> {
  // Private bucket — files are streamed back through our authenticated routes.
  const { error } = await supabase.storage.createBucket(DOCUMENTS_BUCKET, {
    public: false,
  });
  // "already exists" is fine; anything else is logged by the caller.
  if (error && !error.message.toLowerCase().includes("already exists")) {
    console.error("[storage] failed to create documents bucket:", error.message);
  }
}

/**
 * Uploads a file to the documents bucket, creating the bucket on first use if
 * it doesn't exist yet. Returns the stored path, or null if storage failed (so
 * the caller can keep working without a persisted file). Failures are logged
 * rather than swallowed silently.
 */
export async function uploadDocument(
  path: string,
  buffer: Buffer,
  contentType: string | undefined,
  client?: SupabaseClient
): Promise<string | null> {
  const supabase = client ?? createAdminClient();
  const options = { contentType: contentType || "application/octet-stream", upsert: false };

  let { error } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(path, buffer, options);

  if (error && isBucketMissing(error)) {
    await ensureBucket(supabase);
    ({ error } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(path, buffer, options));
  }

  if (error) {
    console.error("[storage] document upload failed:", error.message);
    return null;
  }
  return path;
}
