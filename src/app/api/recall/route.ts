import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { recallSearch } from "@/lib/search";

export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { query, folderId, libraryId, limit } = await req.json();
  if (!query?.trim()) {
    return NextResponse.json({ error: "Query required" }, { status: 400 });
  }

  const results = await recallSearch({
    userId: user.id,
    query: query.trim(),
    libraryId: libraryId || null,
    folderId: folderId || null,
    limit: limit ?? 20,
  });

  return NextResponse.json({ query: query.trim(), results, count: results.length });
}
