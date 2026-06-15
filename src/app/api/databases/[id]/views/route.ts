import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import {
  databaseErrorResponse,
  requireDatabaseDoc,
} from "@/lib/databases/database-access";
import { mapView } from "@/lib/databases/database-server";
import { VIEW_TYPE_LABELS, type ViewType } from "@/lib/databases/database-schema";

const VALID_VIEWS: ViewType[] = ["TABLE", "BOARD", "CALENDAR"];

/** Add a view, auto-selecting a sensible group/date property. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireDatabaseDoc(id, "EDITOR");
    const body = (await req.json().catch(() => null)) as {
      name?: string;
      type?: ViewType;
    } | null;

    const type = body?.type && VALID_VIEWS.includes(body.type) ? body.type : "TABLE";
    const name = (body?.name?.trim() || VIEW_TYPE_LABELS[type]).slice(0, 200);

    const config: { groupPropertyId?: string; datePropertyId?: string } = {};
    if (type === "BOARD") {
      const select = await prisma.databaseProperty.findFirst({
        where: { documentId: id, type: "SELECT" },
        orderBy: { position: "asc" },
        select: { id: true },
      });
      if (select) config.groupPropertyId = select.id;
    } else if (type === "CALENDAR") {
      const date = await prisma.databaseProperty.findFirst({
        where: { documentId: id, type: "DATE" },
        orderBy: { position: "asc" },
        select: { id: true },
      });
      if (date) config.datePropertyId = date.id;
    }

    const last = await prisma.databaseView.findFirst({
      where: { documentId: id },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const view = await prisma.databaseView.create({
      data: { documentId: id, name, type, position: (last?.position ?? -1) + 1, config },
    });

    return NextResponse.json(mapView(view));
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
