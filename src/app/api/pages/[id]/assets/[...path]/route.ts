import { NextRequest, NextResponse } from "next/server";
import { badRequest, notFound, withAuth } from "@/lib/api/http";
import {
  isInlineAssetType,
  pageAssetStoragePath,
  parsePageAssetRequest,
} from "@/lib/documents/page-assets";
import { prisma } from "@/lib/db/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteParams = { params: Promise<{ id: string; path: string[] }> };

export async function GET(_req: NextRequest, ctx: RouteParams) {
  return withAuth(ctx, async ({ params, user }) => {
    const { id: pageId, path } = params;
    const filename = parsePageAssetRequest(pageId, path);
    if (!filename) throw badRequest("Invalid path");

    const page = await prisma.page.findFirst({ where: { id: pageId, userId: user.id } });
    if (!page) throw notFound();

    const storagePath = pageAssetStoragePath(user.id, pageId, filename);

    try {
      const supabase = createAdminClient();
      const { data, error } = await supabase.storage.from("documents").download(storagePath);
      if (error || !data) throw notFound();

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
    } catch (err) {
      if (err instanceof Error && err.name === "HttpError") throw err;
      return NextResponse.json({ error: "Storage unavailable" }, { status: 503 });
    }
  });
}
