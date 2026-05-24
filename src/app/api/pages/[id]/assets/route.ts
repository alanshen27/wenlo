import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { LibraryAccessError, requireLibraryAccess } from "@/lib/library-access";
import {
  PAGE_ASSET_MAX_BYTES,
  PAGE_ASSET_MIME_TYPES,
  pageAssetStoragePath,
  pageAssetUrl,
} from "@/lib/page-assets";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: pageId } = await params;
  const page = await prisma.page.findFirst({ where: { id: pageId } });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await requireLibraryAccess(user.id, page.libraryId, "EDITOR");
  } catch (error) {
    if (error instanceof LibraryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const ownerId = page.userId;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!PAGE_ASSET_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
  }

  if (file.size > PAGE_ASSET_MAX_BYTES) {
    return NextResponse.json({ error: "Image must be under 10MB" }, { status: 400 });
  }

  const safeName = file.name.replace(/[^\w.\-()+ ]/g, "_").slice(0, 120);
  const filename = `${Date.now()}-${safeName || "image"}`;
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
}
