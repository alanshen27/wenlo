import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { badRequest, notFound, withRoute } from "@/lib/api/http";
import { requireDatabaseDoc } from "@/lib/databases/database-access";
import { mapView } from "@/lib/databases/database-server";
import type { ViewConfig } from "@/lib/databases/database-schema";

type Ctx = { params: Promise<{ id: string; viewId: string }> };

/** Rename a view or change its group/date property. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return withRoute(ctx, async ({ params }) => {
    const { id, viewId } = params;
    await requireDatabaseDoc(id, "EDITOR");

    const existing = await prisma.databaseView.findFirst({
      where: { id: viewId, documentId: id },
    });
    if (!existing) throw notFound();

    const body = (await req.json().catch(() => null)) as {
      name?: string;
      config?: ViewConfig;
    } | null;
    if (!body) throw badRequest("Missing body");

    const data: Record<string, unknown> = {};
    if (typeof body.name === "string") data.name = body.name.trim().slice(0, 200);
    if (body.config && typeof body.config === "object") {
      const current = (existing.config ?? {}) as ViewConfig;
      data.config = { ...current, ...body.config };
    }

    const updated = await prisma.databaseView.update({ where: { id: viewId }, data });
    return NextResponse.json(mapView(updated));
  });
}

/** Delete a view. */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return withRoute(ctx, async ({ params }) => {
    const { id, viewId } = params;
    await requireDatabaseDoc(id, "EDITOR");

    const deleted = await prisma.databaseView.deleteMany({ where: { id: viewId, documentId: id } });
    if (deleted.count === 0) throw notFound();

    return NextResponse.json({ ok: true });
  });
}
