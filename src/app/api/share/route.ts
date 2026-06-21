import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, parseBody, withAuth } from "@/lib/api/http";
import { requireDocument } from "@/lib/documents/document-access";
import { requirePage } from "@/lib/pages/page-access";
import { setDocumentShare, setPageShare } from "@/lib/share/share";
import { ShareAccess } from "@/generated/prisma/client";

const shareSchema = z.object({
  type: z.enum(["page", "document"]),
  id: z.string(),
  access: z.enum(["NONE", "VIEW", "EDIT"]),
  password: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  return withAuth(undefined, async ({ user }) => {
    const { type, id, access, password } = await parseBody(req, shareSchema);

    if (type === "page") {
      await requirePage(user.id, id, "EDITOR");
      const result = await setPageShare(id, access as ShareAccess, password);
      return NextResponse.json(result);
    }

    await requireDocument(user.id, id, { role: "EDITOR" });
    const result = await setDocumentShare(id, access as ShareAccess, password);
    return NextResponse.json(result);
  });
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) throw badRequest("token required");

  const { resolveShareByToken } = await import("@/lib/share/share");
  const resolved = await resolveShareByToken(token);
  if (!resolved) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    type: resolved.type,
    id: resolved.item.id,
    title: resolved.type === "page" ? resolved.item.title : resolved.item.title,
    access: resolved.item.shareAccess,
    hasPassword: Boolean(resolved.item.sharePasswordHash),
  });
}
