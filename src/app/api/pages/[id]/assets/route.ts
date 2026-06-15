import { NextRequest, NextResponse } from "next/server";
import { badRequest, withAuth } from "@/lib/api/http";
import { requirePage } from "@/lib/pages/page-access";
import {
  PAGE_ASSET_MAX_BYTES,
  isAllowedAssetType,
  pageAssetStoragePath,
  pageAssetUrl,
} from "@/lib/documents/page-assets";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteParams) {
  return withAuth(ctx, async ({ params, user }) => {
    const pageId = params.id;
    const page = await requirePage(user.id, pageId, "EDITOR");
    const ownerId = page.userId;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) throw badRequest("No file provided");
    if (!isAllowedAssetType(file.type)) throw badRequest("This file type isn't allowed");
    if (file.size > PAGE_ASSET_MAX_BYTES) throw badRequest("File must be under 50MB");

    const safeName = file.name.replace(/[^\w.\-()+ ]/g, "_").slice(0, 120);
    const filename = `${Date.now()}-${safeName || "file"}`;
    const storagePath = pageAssetStoragePath(ownerId, pageId, filename);
    const buffer = Buffer.from(await file.arrayBuffer());

    try {
      const supabase = createAdminClient();
      const { error } = await supabase.storage.from("documents").upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } catch {
      return NextResponse.json({ error: "Storage unavailable" }, { status: 503 });
    }

    return NextResponse.json({ url: pageAssetUrl(pageId, filename) });
  });
}
