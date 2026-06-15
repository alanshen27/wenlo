import { NextRequest, NextResponse } from "next/server";
import { notFound, withAuth } from "@/lib/api/http";
import { requireDocument } from "@/lib/documents/document-access";
import { isInlineAssetType } from "@/lib/documents/page-assets";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Streams the original uploaded file so it can be previewed (images, audio,
 * video) or downloaded from the file preview panel. Media is served inline;
 * everything else is sent as an attachment so markup can't execute on our
 * origin.
 */
export async function GET(req: NextRequest, ctx: RouteParams) {
  return withAuth(ctx, async ({ params, user }) => {
    const document = await requireDocument(user.id, params.id);

    if (!document.storagePath) throw notFound("No file stored");

    try {
      const supabase = createAdminClient();
      const { data, error } = await supabase.storage
        .from("documents")
        .download(document.storagePath);
      if (error || !data) throw notFound();

      const buffer = Buffer.from(await data.arrayBuffer());
      const contentType = document.mimeType || data.type || "application/octet-stream";
      const downloadName = (document.title || "file").replace(/"/g, "");
      const forceDownload = req.nextUrl.searchParams.get("download") === "1";
      const disposition =
        !forceDownload && isInlineAssetType(contentType)
          ? "inline"
          : `attachment; filename="${downloadName}"`;

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": disposition,
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, max-age=3600",
        },
      });
    } catch (err) {
      // A genuine "not found" should surface as 404; anything else is storage.
      if (err instanceof Error && err.name === "HttpError") throw err;
      return NextResponse.json({ error: "Storage unavailable" }, { status: 503 });
    }
  });
}
