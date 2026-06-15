import { NextRequest, NextResponse } from "next/server";
import { notFound, withAuth } from "@/lib/api/http";
import { requirePage } from "@/lib/pages/page-access";
import { getPageVersion } from "@/lib/pages/page-versions";

type RouteParams = { params: Promise<{ id: string; versionId: string }> };

export async function GET(_req: NextRequest, ctx: RouteParams) {
  return withAuth(ctx, async ({ params, user }) => {
    await requirePage(user.id, params.id);
    const version = await getPageVersion(params.id, params.versionId);
    if (!version) throw notFound();

    return NextResponse.json({
      ...version,
      createdAt: version.createdAt.toISOString(),
    });
  });
}
