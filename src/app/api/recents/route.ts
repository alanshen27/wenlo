import { NextResponse, type NextRequest } from "next/server";
import { badRequest, withAuth } from "@/lib/api/http";
import { isNativeKind } from "@/lib/native/native-types";
import { listRecents } from "@/lib/native/recents";

export async function GET(req: NextRequest) {
  return withAuth(undefined, async ({ user }) => {
    const kind = req.nextUrl.searchParams.get("kind");
    if (!kind || !isNativeKind(kind)) throw badRequest("Unknown kind");

    const rawLimit = Number(req.nextUrl.searchParams.get("limit"));
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 60) : 24;

    const items = await listRecents(user.id, kind, limit);
    return NextResponse.json({ items });
  });
}
