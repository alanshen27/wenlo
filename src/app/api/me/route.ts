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
      avatarUrl: user.avatarUrl,
      usage,
      billing,
    });
  });
}

export async function PATCH(req: NextRequest) {
  return withAuth(undefined, async ({ user }) => {
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : undefined;
    const hasAvatar = "avatarUrl" in body;
    const avatarUrl = hasAvatar
      ? typeof body.avatarUrl === "string" && body.avatarUrl.trim()
        ? body.avatarUrl.trim()
        : null
      : undefined;

    if (name === undefined && avatarUrl === undefined && !hasAvatar) {
      throw badRequest("Nothing to update");
    }
    if (avatarUrl && !/^https?:\/\//i.test(avatarUrl)) {
      throw badRequest("Avatar must be a valid http(s) URL");
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(name !== undefined ? { name: name || null } : {}),
        ...(hasAvatar ? { avatarUrl } : {}),
      },
    });

    return NextResponse.json({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      avatarUrl: updated.avatarUrl,
    });
  });
}
