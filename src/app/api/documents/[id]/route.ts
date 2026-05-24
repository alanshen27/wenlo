import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { LibraryAccessError, requireLibraryAccess } from "@/lib/library-access";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  return NextResponse.json(document);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const document = await prisma.document.findFirst({ where: { id } });
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await requireLibraryAccess(user.id, document.libraryId, "EDITOR");
  } catch (error) {
    if (error instanceof LibraryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  if (document.storagePath) {
    try {
      const supabase = createAdminClient();
      await supabase.storage.from("documents").remove([document.storagePath]);
    } catch {
      // ignore
    }
  }

  await prisma.document.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { folderId, title } = await req.json();

  const existing = await prisma.document.findFirst({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await requireLibraryAccess(user.id, existing.libraryId, "EDITOR");
  } catch (error) {
    if (error instanceof LibraryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const document = await prisma.document.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title.trim() || existing.title }),
      ...(folderId !== undefined && {
        folderId: folderId && folderId !== "__root__" ? folderId : null,
      }),
    },
  });

  return NextResponse.json(document);
}
