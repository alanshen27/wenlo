import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/auth";
import { LibraryAccessError, requireLibraryAccess } from "@/lib/library/library-access";
import { isInlineAssetType } from "@/lib/documents/page-assets";
import { prisma } from "@/lib/db/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Streams the original uploaded file so it can be previewed (images, audio,
 * video) or downloaded from the file preview panel. Media is served inline;
 * everything else is sent as an attachment so markup can't execute on our
 * origin.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const document = await prisma.document.findFirst({ where: { id } });
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await requireLibraryAccess(user.id, document.libraryId, "VIEWER");
  } catch (error) {
    if (error instanceof LibraryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  if (!document.storagePath) {
    return NextResponse.json({ error: "No file stored" }, { status: 404 });
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.storage
      .from("documents")
      .download(document.storagePath);
    if (error || !data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

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
  } catch {
    return NextResponse.json({ error: "Storage unavailable" }, { status: 503 });
  }
}
