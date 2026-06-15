import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import {
  databaseErrorResponse,
  requireDatabaseDoc,
} from "@/lib/databases/database-access";
import { mapView } from "@/lib/databases/database-server";
import type { ViewConfig } from "@/lib/databases/database-schema";

/** Rename a view or change its group/date property. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; viewId: string }> }
) {
  try {
    const { id, viewId } = await params;
    await requireDatabaseDoc(id, "EDITOR");

    const existing = await prisma.databaseView.findFirst({
      where: { id: viewId, documentId: id },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = (await req.json().catch(() => null)) as {
      name?: string;
      config?: ViewConfig;
    } | null;
    if (!body) return NextResponse.json({ error: "Missing body" }, { status: 400 });

    const data: Record<string, unknown> = {};
    if (typeof body.name === "string") data.name = body.name.trim().slice(0, 200);
    if (body.config && typeof body.config === "object") {
      const current = (existing.config ?? {}) as ViewConfig;
      data.config = { ...current, ...body.config };
    }

    const updated = await prisma.databaseView.update({ where: { id: viewId }, data });
    return NextResponse.json(mapView(updated));
  } catch (error) {
    return databaseErrorResponse(error);
  }
}

/** Delete a view. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; viewId: string }> }
) {
  try {
    const { id, viewId } = await params;
    await requireDatabaseDoc(id, "EDITOR");

    const deleted = await prisma.databaseView.deleteMany({ where: { id: viewId, documentId: id } });
    if (deleted.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
