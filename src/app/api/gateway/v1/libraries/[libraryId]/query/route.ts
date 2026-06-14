import { NextRequest, NextResponse } from "next/server";
import {
  gatewayErrorResponse,
  requireGatewayAuth,
  resolveGatewayFolderId,
} from "@/lib/auth/gateway-auth";
import { recallSearch } from "@/lib/search/search";

type RouteParams = { params: Promise<{ libraryId: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { libraryId } = await params;
    const { userId } = await requireGatewayAuth(req, libraryId);
    const { q, query, folderId, limit } = await req.json();

    const searchQuery = (q ?? query ?? "").trim();
    if (!searchQuery) {
      return NextResponse.json({ error: "Query required (q or query)" }, { status: 400 });
    }

    const resolvedFolderId =
      folderId === undefined ? null : await resolveGatewayFolderId(userId, libraryId, folderId);

    const results = await recallSearch({
      userId,
      libraryId,
      folderId: resolvedFolderId,
      query: searchQuery,
      limit: Math.min(Number(limit ?? 20), 50),
    });

    return NextResponse.json({ query: searchQuery, results });
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
