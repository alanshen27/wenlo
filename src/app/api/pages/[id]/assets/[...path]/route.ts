import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  isInlineAssetType,
  pageAssetStoragePath,
  parsePageAssetRequest,
} from "@/lib/page-assets";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteParams = { params: Promise<{ id: string; path: string[] }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: pageId, path } = await params;
  const filename = parsePageAssetRequest(pageId, path);
  if (!filename) return NextResponse.json({ error: "Invalid path" }, { status: 400 });

  const page = await prisma.page.findFirst({ where: { id: pageId, userId: user.id } });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const storagePath = pageAssetStoragePath(user.id, pageId, filename);

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.storage.from("documents").download(storagePath);
    if (error || !data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    const contentType = data.type || "application/octet-stream";
    const downloadName = filename.split("/").pop() || "file";
    // Media renders inline; anything else downloads so markup can't execute on our origin.
    const disposition = isInlineAssetType(contentType)
      ? "inline"
      : `attachment; filename="${downloadName.replace(/"/g, "")}"`;
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": disposition,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Storage unavailable" }, { status: 503 });
  }
}
