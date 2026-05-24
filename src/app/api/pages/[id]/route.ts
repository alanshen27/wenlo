import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { indexPage } from "@/lib/search";
import { extractPlainText } from "@/lib/editor-content";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const page = await prisma.page.findFirst({ where: { id, userId: user.id } });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

  const existing = await prisma.page.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const plainText = content !== undefined ? extractPlainText(content) : existing.plainText;

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
  const page = await prisma.page.findFirst({ where: { id, userId: user.id } });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.page.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
