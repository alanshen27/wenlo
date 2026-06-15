import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/http";
import { requirePage } from "@/lib/pages/page-access";
import {
  leavePagePresence,
  listPageCollaborators,
  touchPagePresence,
} from "@/lib/realtime/page-presence";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteParams) {
  return withAuth(ctx, async ({ params, user }) => {
    await requirePage(user.id, params.id);
    const collaborators = await listPageCollaborators(params.id, user.id);
    return NextResponse.json({ collaborators });
  });
}

export async function POST(_req: NextRequest, ctx: RouteParams) {
  return withAuth(ctx, async ({ params, user }) => {
    await requirePage(user.id, params.id);
    await touchPagePresence(params.id, user);
    const collaborators = await listPageCollaborators(params.id, user.id);
    return NextResponse.json({ collaborators });
  });
}

export async function DELETE(_req: NextRequest, ctx: RouteParams) {
  return withAuth(ctx, async ({ params, user }) => {
    await leavePagePresence(params.id, user.id);
    return NextResponse.json({ ok: true });
  });
}
