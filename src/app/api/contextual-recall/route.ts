import { NextRequest, NextResponse } from "next/server";
import { badRequest, withAuth } from "@/lib/api/http";
import { requireLibraryAccess } from "@/lib/library/library-access";
import { recallSearch } from "@/lib/search/search";
import { assertWithinTokenLimit, UsageLimitError } from "@/lib/billing/usage";

/** Inline contextual suggestions while editing — semantic matches for current paragraph. */
export async function POST(req: NextRequest) {
  return withAuth(undefined, async ({ user }) => {
    try {
      await assertWithinTokenLimit(user.id);
    } catch (error) {
      if (error instanceof UsageLimitError) {
        return NextResponse.json({ error: error.message }, { status: 429 });
      }
      throw error;
    }

    const { text, libraryId, limit } = await req.json();
    if (!text?.trim() || text.trim().length < 40) {
      return NextResponse.json({ results: [] });
    }
    if (!libraryId) throw badRequest("libraryId required");

    await requireLibraryAccess(user.id, libraryId, "VIEWER");

    const paragraph = text.trim().slice(-500);
    const results = await recallSearch({
      userId: user.id,
      query: paragraph,
      libraryId,
      limit: limit ?? 5,
    });

    return NextResponse.json({ results });
  });
}
