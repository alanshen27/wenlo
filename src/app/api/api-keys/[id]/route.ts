import { NextResponse } from "next/server";
import { notFound, withAuth } from "@/lib/api/http";
import { prisma } from "@/lib/db/prisma";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, ctx: RouteParams) {
  return withAuth(ctx, async ({ params, user }) => {
    const { id } = params;
    const existing = await prisma.apiKey.findFirst({
      where: { id, userId: user.id, revokedAt: null },
    });

    if (!existing) throw notFound();

    await prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  });
}
