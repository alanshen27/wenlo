import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { badRequest, notFound, withRoute } from "@/lib/api/http";
import { requireDatabaseDoc } from "@/lib/databases/database-access";
import { loadMappedRow, reindexDatabase, writeRowCells } from "@/lib/databases/database-server";
import type { CellValue } from "@/lib/databases/database-schema";

type Ctx = { params: Promise<{ id: string; rowId: string }> };

/** Set cell values (and/or position) on a row. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return withRoute(ctx, async ({ params }) => {
    const { id, rowId } = params;
    const { userId } = await requireDatabaseDoc(id, "EDITOR");

    const row = await prisma.databaseRow.findFirst({
      where: { id: rowId, documentId: id },
      select: { id: true },
    });
    if (!row) throw notFound();

    const body = (await req.json().catch(() => null)) as {
      cells?: Record<string, CellValue>;
      position?: number;
    } | null;
    if (!body) throw badRequest("Missing body");

    if (body.cells && Object.keys(body.cells).length) {
      const props = await prisma.databaseProperty.findMany({
        where: { documentId: id },
        select: { id: true, type: true },
      });
      await writeRowCells(rowId, body.cells, props);
    }
    if (typeof body.position === "number") {
      await prisma.databaseRow.update({ where: { id: rowId }, data: { position: body.position } });
    }

    after(() => reindexDatabase(id, userId).catch(() => {}));
    const mapped = await loadMappedRow(id, rowId);
    return NextResponse.json(mapped ?? { ok: true });
  });
}

/** Delete a row (cells cascade). */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return withRoute(ctx, async ({ params }) => {
    const { id, rowId } = params;
    const { userId } = await requireDatabaseDoc(id, "EDITOR");

    const deleted = await prisma.databaseRow.deleteMany({ where: { id: rowId, documentId: id } });
    if (deleted.count === 0) throw notFound();

    after(() => reindexDatabase(id, userId).catch(() => {}));
    return NextResponse.json({ ok: true });
  });
}
