import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/auth";
import { LibraryAccessError, requireLibraryAccess } from "@/lib/library/library-access";
import { snapshotPageBeforeUpdate } from "@/lib/pages/page-versions";
import { prisma } from "@/lib/db/prisma";
import { indexPage } from "@/lib/search/search";
import { extractPlainText } from "@/lib/editor/editor-content";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const page = await prisma.page.findFirst({ where: { id } });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await requireLibraryAccess(user.id, page.libraryId, "VIEWER");
  } catch (error) {
    if (error instanceof LibraryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  return NextResponse.json(page);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { title, content, folderId } = await req.json();

  const existing = await prisma.page.findFirst({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await requireLibraryAccess(user.id, existing.libraryId, "EDITOR");
  } catch (error) {
    if (error instanceof LibraryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const plainText = content !== undefined ? extractPlainText(content) : existing.plainText;

  const contentChanged =
    content !== undefined &&
    JSON.stringify(content) !== JSON.stringify(existing.content);
  const titleChanged =
    title !== undefined && (title.trim() || "Untitled") !== existing.title;

  if (contentChanged || titleChanged) {
    await snapshotPageBeforeUpdate(existing, user).catch(() => {});
  }

  const page = await prisma.page.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title.trim() || "Untitled" }),
      ...(content !== undefined && { content, plainText }),
      ...(folderId !== undefined && {
        folderId: folderId && folderId !== "__root__" ? folderId : null,
      }),
    },
  });

  await indexPage(page.id, page.title, page.plainText).catch(() => {});

  return NextResponse.json(page);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const page = await prisma.page.findFirst({ where: { id } });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await requireLibraryAccess(user.id, page.libraryId, "EDITOR");
  } catch (error) {
    if (error instanceof LibraryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  await prisma.page.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
