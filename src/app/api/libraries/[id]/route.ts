import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { requireLibrary } from "@/lib/libraries";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    await requireLibrary(user.id, id);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { name, icon } = await req.json();

  const library = await prisma.library.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(icon !== undefined && { icon }),
    },
  });

  return NextResponse.json(library);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    await requireLibrary(user.id, id);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const count = await prisma.library.count({ where: { userId: user.id } });
  if (count <= 1) {
    return NextResponse.json({ error: "Cannot delete your only library" }, { status: 400 });
  }

  await prisma.library.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
