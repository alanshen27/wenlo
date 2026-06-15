import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/db/prisma";
import {
  databaseErrorResponse,
  requireDatabaseDoc,
} from "@/lib/databases/database-access";
import { mapProperty, reindexDatabase } from "@/lib/databases/database-server";
import type { PropertyType, SelectOption } from "@/lib/databases/database-schema";

const VALID_TYPES: PropertyType[] = ["TEXT", "NUMBER", "SELECT", "DATE", "CHECKBOX"];

/** Rename / retype / set options / resize a column. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; propertyId: string }> }
) {
  try {
    const { id, propertyId } = await params;
    const { userId } = await requireDatabaseDoc(id, "EDITOR");

    const existing = await prisma.databaseProperty.findFirst({
      where: { id: propertyId, documentId: id },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = (await req.json().catch(() => null)) as {
      name?: string;
      type?: PropertyType;
      options?: SelectOption[];
      width?: number | null;
    } | null;
    if (!body) return NextResponse.json({ error: "Missing body" }, { status: 400 });

    const data: Record<string, unknown> = {};
    if (typeof body.name === "string") data.name = body.name.trim().slice(0, 200);
    if (typeof body.width === "number" || body.width === null) data.width = body.width;

    const retyped = body.type && VALID_TYPES.includes(body.type) && body.type !== existing.type;
    if (retyped) {
      data.type = body.type;
      // Values stored in the old typed column no longer apply — clear cells so
      // the column starts clean in its new type.
      await prisma.databaseCell.deleteMany({ where: { propertyId } });
      data.options = body.type === "SELECT" ? (body.options ?? []) : undefined;
    } else if (Array.isArray(body.options) && (body.type ?? existing.type) === "SELECT") {
      data.options = body.options;
    }

    const updated = await prisma.databaseProperty.update({
      where: { id: propertyId },
      data,
    });

    after(() => reindexDatabase(id, userId).catch(() => {}));
    return NextResponse.json(mapProperty(updated));
  } catch (error) {
    return databaseErrorResponse(error);
  }
}

/** Delete a column (cells cascade); prune it from any view config. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; propertyId: string }> }
) {
  try {
    const { id, propertyId } = await params;
    const { userId } = await requireDatabaseDoc(id, "EDITOR");

    const existing = await prisma.databaseProperty.findFirst({
      where: { id: propertyId, documentId: id },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.databaseProperty.delete({ where: { id: propertyId } });

    // Clear any view that grouped/dated on this property.
    const views = await prisma.databaseView.findMany({ where: { documentId: id } });
    for (const view of views) {
      const config = (view.config ?? {}) as { groupPropertyId?: string; datePropertyId?: string };
      if (config.groupPropertyId === propertyId || config.datePropertyId === propertyId) {
        const next = { ...config };
        if (next.groupPropertyId === propertyId) next.groupPropertyId = undefined;
        if (next.datePropertyId === propertyId) next.datePropertyId = undefined;
        await prisma.databaseView.update({ where: { id: view.id }, data: { config: next } });
      }
    }

    after(() => reindexDatabase(id, userId).catch(() => {}));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
