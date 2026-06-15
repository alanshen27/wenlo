import { NextRequest, NextResponse } from "next/server";
import { badRequest, withAuth } from "@/lib/api/http";
import { requireLibraryAccess } from "@/lib/library/library-access";
import {
  createRecallChatSession,
  listRecallChatSessions,
  recallScopeKey,
} from "@/lib/recall-chat/recall-chat";

type RouteParams = { params: Promise<{ id: string }> };

/** Resolve the chat scope from query params, throwing 400 on invalid input. */
function parseScope(req: NextRequest) {
  const scope = req.nextUrl.searchParams.get("scope");
  const folderId = req.nextUrl.searchParams.get("folderId");
  if (scope !== "all" && scope !== "folder") {
    throw badRequest("Invalid scope");
  }
  if (scope === "folder" && !folderId) {
    throw badRequest("folderId required for folder scope");
  }
  return {
    scope,
    folderId: scope === "folder" ? folderId : null,
    scopeKey: recallScopeKey(scope, scope === "folder" ? folderId : null),
  };
}

export async function GET(req: NextRequest, ctx: RouteParams) {
  return withAuth(ctx, async ({ params, user }) => {
    const libraryId = params.id;
    const parsed = parseScope(req);
    await requireLibraryAccess(user.id, libraryId, "VIEWER");

    const sessions = await listRecallChatSessions(user.id, libraryId, parsed.scopeKey);
    return NextResponse.json({ sessions });
  });
}

export async function POST(req: NextRequest, ctx: RouteParams) {
  return withAuth(ctx, async ({ params, user }) => {
    const libraryId = params.id;
    const parsed = parseScope(req);
    await requireLibraryAccess(user.id, libraryId, "VIEWER");

    const session = await createRecallChatSession(user.id, libraryId, parsed.scopeKey);
    return NextResponse.json({ session });
  });
}
