import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { badRequest, withRoute } from "@/lib/api/http";
import { requireDatabaseDoc } from "@/lib/databases/database-access";
import { mapProperty, reindexDatabase } from "@/lib/databases/database-server";
import type { PropertyType } from "@/lib/databases/database-schema";

const VALID_TYPES: PropertyType[] = ["TEXT", "NUMBER", "SELECT", "DATE", "CHECKBOX"];

type Ctx = { params: Promise<{ id: string }> };

/** Add a column. */
export async function POST(req: NextRequest, ctx: Ctx) {
  return withRoute(ctx, async ({ params }) => {
    const { id } = params;
    const { userId } = await requireDatabaseDoc(id, "EDITOR");
    const body = (await req.json().catch(() => null)) as {
      name?: string;
      type?: PropertyType;
    } | null;

    const type = body?.type && VALID_TYPES.includes(body.type) ? body.type : "TEXT";
    const name = (body?.name?.trim() || defaultPropertyName(type)).slice(0, 200);

    const last = await prisma.databaseProperty.findFirst({
      where: { documentId: id },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const property = await prisma.databaseProperty.create({
      data: {
        documentId: id,
        name,
        type,
        position: (last?.position ?? -1) + 1,
        options: type === "SELECT" ? [] : undefined,
      },
    });

    after(() => reindexDatabase(id, userId).catch(() => {}));
    return NextResponse.json(mapProperty(property));
  });
}

/** Reorder columns: body `{ order: string[] }`. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return withRoute(ctx, async ({ params }) => {
    const { id } = params;
    await requireDatabaseDoc(id, "EDITOR");
    const body = (await req.json().catch(() => null)) as { order?: string[] } | null;
    if (!Array.isArray(body?.order)) throw badRequest("Missing order");

    await prisma.$transaction(
      body.order.map((propertyId, index) =>
        prisma.databaseProperty.updateMany({
          where: { id: propertyId, documentId: id },
          data: { position: index },
        })
      )
    );

    return NextResponse.json({ ok: true });
  });
}

function defaultPropertyName(type: PropertyType): string {
  switch (type) {
    case "NUMBER":
      return "Number";
    case "SELECT":
      return "Select";
    case "DATE":
      return "Date";
    case "CHECKBOX":
      return "Checkbox";
    default:
      return "Text";
  }
}
