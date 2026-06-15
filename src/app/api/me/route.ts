import { NextRequest, NextResponse } from "next/server";
import { badRequest, withAuth } from "@/lib/api/http";
import { getBillingSummary } from "@/lib/billing/billing";
import { prisma } from "@/lib/db/prisma";
import { getUsageSummary } from "@/lib/billing/usage";

export async function GET() {
  return withAuth(undefined, async ({ user }) => {
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
  });
}

export async function PATCH(req: NextRequest) {
  return withAuth(undefined, async ({ user }) => {
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : undefined;

    if (name === undefined) throw badRequest("Nothing to update");

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { name: name || null },
    });

    return NextResponse.json({
      id: updated.id,
      email: updated.email,
      name: updated.name,
    });
  });
}
