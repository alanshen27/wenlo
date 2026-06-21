import { NextRequest, NextResponse } from "next/server";
import { badRequest, withAuth } from "@/lib/api/http";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { recallSearch } from "@/lib/search/search";

export async function POST(req: NextRequest) {
  return withAuth(undefined, async ({ user }) => {
    await enforceRateLimit(user.id, user.plan, "recall");
    const { query, folderId, libraryId, limit } = await req.json();
    if (!query?.trim()) throw badRequest("Query required");

    const results = await recallSearch({
      userId: user.id,
      query: query.trim(),
      libraryId: libraryId || null,
      folderId: folderId || null,
      limit: limit ?? 20,
    });

    return NextResponse.json({ query: query.trim(), results, count: results.length });
  });
}
