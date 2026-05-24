import { NextResponse } from "next/server";
import { extractBearerKey, hashApiKey } from "@/lib/api-keys";
import { requireLibrary } from "@/lib/libraries";
import { prisma } from "@/lib/prisma";

export class GatewayAuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export async function requireGatewayAuth(req: Request, libraryId: string) {
  const rawKey = extractBearerKey(req);
  if (!rawKey) {
    throw new GatewayAuthError("Missing or invalid Authorization header. Use: Bearer rcsk_…");
  }

  const keyHash = hashApiKey(rawKey);
  const apiKey = await prisma.apiKey.findFirst({
    where: { keyHash, revokedAt: null },
  });

  if (!apiKey) {
    throw new GatewayAuthError("Invalid API key");
  }

  if (apiKey.libraryId && apiKey.libraryId !== libraryId) {
    throw new GatewayAuthError("API key is not authorized for this library", 403);
  }

  await requireLibrary(apiKey.userId, libraryId);

  void prisma.apiKey
    .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return { userId: apiKey.userId, apiKeyId: apiKey.id };
}

export function gatewayErrorResponse(error: unknown) {
  if (error instanceof GatewayAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof Error && error.message === "Library not found") {
    return NextResponse.json({ error: "Library not found" }, { status: 404 });
  }
  console.error("[gateway]", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export async function resolveGatewayFolderId(
  userId: string,
  libraryId: string,
  folderId: string | null | undefined
) {
  if (folderId == null || folderId === "" || folderId === "root" || folderId === "__root__") {
    return null;
  }
  const folder = await prisma.folder.findFirst({
    where: { id: folderId, userId, libraryId },
  });
  if (!folder) throw new GatewayAuthError("Folder not found in this library", 404);
  return folder.id;
}
