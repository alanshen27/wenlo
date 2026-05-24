import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { LibraryAccessError, requireLibraryAccess } from "@/lib/library-access";
import {
  createRecallChatSession,
  listRecallChatSessions,
  recallScopeKey,
} from "@/lib/recall-chat";

type RouteParams = { params: Promise<{ id: string }> };

function parseScope(req: NextRequest) {
  const scope = req.nextUrl.searchParams.get("scope");
  const folderId = req.nextUrl.searchParams.get("folderId");
  if (scope !== "all" && scope !== "folder") {
    return { error: "Invalid scope" as const };
  }
  if (scope === "folder" && !folderId) {
    return { error: "folderId required for folder scope" as const };
  }
  return {
    scope,
    folderId: scope === "folder" ? folderId : null,
    scopeKey: recallScopeKey(scope, scope === "folder" ? folderId : null),
  };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: libraryId } = await params;
  const parsed = parseScope(req);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    await requireLibraryAccess(user.id, libraryId, "VIEWER");
  } catch (error) {
    if (error instanceof LibraryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const sessions = await listRecallChatSessions(user.id, libraryId, parsed.scopeKey);
  return NextResponse.json({ sessions });
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: libraryId } = await params;
  const parsed = parseScope(req);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    await requireLibraryAccess(user.id, libraryId, "VIEWER");
  } catch (error) {
    if (error instanceof LibraryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const session = await createRecallChatSession(user.id, libraryId, parsed.scopeKey);
  return NextResponse.json({ session });
}
