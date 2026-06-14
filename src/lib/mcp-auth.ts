import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { extractBearerKey, hashApiKey } from "@/lib/api-keys";
import { requireLibrary } from "@/lib/libraries";
import { prisma } from "@/lib/prisma";

/**
 * Auth context we stash on `AuthInfo.extra` so individual MCP tools can resolve
 * the calling user and enforce per-library scoping without re-hashing the key.
 */
export type McpAuthExtra = {
  userId: string;
  apiKeyId: string;
  /** Non-null when the API key is locked to a single library. */
  scopedLibraryId: string | null;
};

export function getMcpAuthExtra(authInfo: AuthInfo | undefined): McpAuthExtra {
  const extra = authInfo?.extra as McpAuthExtra | undefined;
  if (!extra?.userId) {
    throw new Error("Unauthorized: missing API key context");
  }
  return extra;
}

/**
 * Validates a Recall API key (`rcsk_…`) presented as the MCP bearer token and
 * returns an MCP `AuthInfo`. Returning `undefined` makes `withMcpAuth` reject
 * the request with a 401.
 */
export async function verifyRecallApiKey(
  req: Request,
  bearerToken?: string
): Promise<AuthInfo | undefined> {
  const rawKey = bearerToken?.startsWith("rcsk_") ? bearerToken : extractBearerKey(req);
  if (!rawKey) return undefined;

  const apiKey = await prisma.apiKey.findFirst({
    where: { keyHash: hashApiKey(rawKey), revokedAt: null },
  });
  if (!apiKey) return undefined;

  void prisma.apiKey
    .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  const extra: McpAuthExtra = {
    userId: apiKey.userId,
    apiKeyId: apiKey.id,
    scopedLibraryId: apiKey.libraryId,
  };

  return {
    token: rawKey,
    clientId: apiKey.id,
    scopes: [],
    extra,
  };
}

/**
 * Ensures the authenticated key may act on `libraryId`: respects the key's
 * library scope and confirms the user still has access to the library.
 * Returns the resolved library id for convenience.
 */
export async function authorizeLibrary(
  auth: McpAuthExtra,
  libraryId: string
): Promise<string> {
  if (auth.scopedLibraryId && auth.scopedLibraryId !== libraryId) {
    throw new Error("This API key is not authorized for the requested library");
  }
  await requireLibrary(auth.userId, libraryId);
  return libraryId;
}
