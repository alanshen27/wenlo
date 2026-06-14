import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/auth";
import { getBillingSummary } from "@/lib/billing/billing";
import { prisma } from "@/lib/db/prisma";
import { getUsageSummary } from "@/lib/billing/usage";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [usage, billing] = await Promise.all([
    getUsageSummary(user.id),
    getBillingSummary(user),
  ]);

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    usage,
    billing,
  });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : undefined;

  if (name === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { name: name || null },
  });

  return NextResponse.json({
    id: updated.id,
    email: updated.email,
    name: updated.name,
  });
}
