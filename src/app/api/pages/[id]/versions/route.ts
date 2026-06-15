import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/http";
import { requirePage } from "@/lib/pages/page-access";
import { listPageVersions } from "@/lib/pages/page-versions";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteParams) {
  return withAuth(ctx, async ({ params, user }) => {
    await requirePage(user.id, params.id);
    const versions = await listPageVersions(params.id);
    return NextResponse.json({ versions });
  });
}
