import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/auth";
import { generateApiKeyMaterial } from "@/lib/auth/api-keys";
import { resolveLibraryId } from "@/lib/library/libraries";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const keys = await prisma.apiKey.findMany({
    where: { userId: user.id, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      libraryId: true,
      lastUsedAt: true,
      createdAt: true,
      library: { select: { id: true, name: true, icon: true } },
    },
  });

  return NextResponse.json({ keys });
}

export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, libraryId: rawLibraryId } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  let libraryId: string | null = null;
  if (rawLibraryId) {
    libraryId = await resolveLibraryId(user.id, rawLibraryId);
  }

  const { key, keyPrefix, keyHash } = generateApiKeyMaterial();

  const apiKey = await prisma.apiKey.create({
    data: {
      userId: user.id,
      libraryId,
      name: name.trim(),
      keyPrefix,
      keyHash,
    },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      libraryId: true,
      createdAt: true,
      library: { select: { id: true, name: true, icon: true } },
    },
  });

  return NextResponse.json(
    {
      key,
      apiKey,
      hint: "Store this key now — it won't be shown again.",
    },
    { status: 201 }
  );
}
