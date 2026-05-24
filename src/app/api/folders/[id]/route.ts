import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { name, parentId, color } = await req.json();

  const folder = await prisma.folder.findFirst({ where: { id, userId: user.id } });
  if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.folder.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(color !== undefined && { color }),
      ...(parentId !== undefined && { parentId: parentId || null }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const folder = await prisma.folder.findFirst({ where: { id, userId: user.id } });
  if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.folder.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
