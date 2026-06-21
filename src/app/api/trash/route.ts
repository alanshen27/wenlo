import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, parseBody, withAuth } from "@/lib/api/http";
import { requireLibraryAccess } from "@/lib/library/library-access";
import { resolveLibraryId } from "@/lib/library/libraries";
import {
  listTrashItems,
  permanentlyDeleteItem,
  restoreTrashItem,
} from "@/lib/soft-delete/soft-delete";

export async function GET(req: NextRequest) {
  return withAuth(undefined, async ({ user }) => {
    const libraryId = await resolveLibraryId(
      user.id,
      req.nextUrl.searchParams.get("libraryId")
    );
    await requireLibraryAccess(user.id, libraryId, "VIEWER");
    const items = await listTrashItems(libraryId);
    return NextResponse.json({ items });
  });
}

const actionSchema = z.object({
  type: z.enum(["page", "document", "folder"]),
  id: z.string(),
  libraryId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  return withAuth(undefined, async ({ user }) => {
    const { type, id, libraryId: rawLibraryId } = await parseBody(req, actionSchema);
    const libraryId = await resolveLibraryId(user.id, rawLibraryId ?? null);
    await requireLibraryAccess(user.id, libraryId, "EDITOR");
    await restoreTrashItem(type, id);
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(req: NextRequest) {
  return withAuth(undefined, async ({ user }) => {
    const type = req.nextUrl.searchParams.get("type");
    const id = req.nextUrl.searchParams.get("id");
    if (!type || !id) throw badRequest("type and id required");
    if (!["page", "document", "folder"].includes(type)) {
      throw badRequest("Invalid type");
    }

    const libraryId = await resolveLibraryId(
      user.id,
      req.nextUrl.searchParams.get("libraryId")
    );
    await requireLibraryAccess(user.id, libraryId, "EDITOR");
    await permanentlyDeleteItem(type as "page" | "document" | "folder", id);
    return NextResponse.json({ ok: true });
  });
}
