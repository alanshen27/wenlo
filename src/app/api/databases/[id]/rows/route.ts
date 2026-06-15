import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/db/prisma";
import {
  databaseErrorResponse,
  requireDatabaseDoc,
} from "@/lib/databases/database-access";
import { loadMappedRow, reindexDatabase, writeRowCells } from "@/lib/databases/database-server";
import type { CellValue } from "@/lib/databases/database-schema";

/** Add a row, optionally seeded with initial cell values. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { userId } = await requireDatabaseDoc(id, "EDITOR");
    const body = (await req.json().catch(() => null)) as {
      cells?: Record<string, CellValue>;
    } | null;

    const last = await prisma.databaseRow.findFirst({
      where: { documentId: id },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const row = await prisma.databaseRow.create({
      data: { documentId: id, position: (last?.position ?? -1) + 1 },
    });

    if (body?.cells && Object.keys(body.cells).length) {
      const props = await prisma.databaseProperty.findMany({
        where: { documentId: id },
        select: { id: true, type: true },
      });
      await writeRowCells(row.id, body.cells, props);
    }

    after(() => reindexDatabase(id, userId).catch(() => {}));
    const mapped = await loadMappedRow(id, row.id);
    return NextResponse.json(mapped ?? { id: row.id, position: row.position, cells: {} });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}

/** Reorder rows: body `{ order: string[] }`. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireDatabaseDoc(id, "EDITOR");
    const body = (await req.json().catch(() => null)) as { order?: string[] } | null;
    if (!Array.isArray(body?.order)) {
      return NextResponse.json({ error: "Missing order" }, { status: 400 });
    }

    await prisma.$transaction(
      body.order.map((rowId, index) =>
        prisma.databaseRow.updateMany({
          where: { id: rowId, documentId: id },
          data: { position: index },
        })
      )
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
