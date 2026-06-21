import { NextRequest, NextResponse } from "next/server";
import { badRequest, withAuth } from "@/lib/api/http";
import { getBillingSummary } from "@/lib/billing/billing";
import { prisma } from "@/lib/db/prisma";
import { STORAGE_LIMITS, formatBytes, getLibraryStorageUsage } from "@/lib/billing/storage";
import { getUsageSummary } from "@/lib/billing/usage";
import { completeOnboarding } from "@/lib/onboarding/onboarding";

export async function GET() {
  return withAuth(undefined, async ({ user }) => {
    const [usage, billing, storageLibraries] = await Promise.all([
      getUsageSummary(user.id),
      getBillingSummary(user),
      prisma.library.findMany({
        where: { OR: [{ userId: user.id }, { members: { some: { userId: user.id } } }] },
        select: { id: true, name: true },
      }),
    ]);

    const storage = await Promise.all(
      storageLibraries.map(async (lib) => ({
        libraryId: lib.id,
        libraryName: lib.name,
        ...(await getLibraryStorageUsage(lib.id, user.plan)),
      }))
    );

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      plan: user.plan,
      onboardingCompletedAt: user.onboardingCompletedAt,
      needsOnboarding: user.onboardingCompletedAt == null,
      usage,
      billing,
      storage,
      storageLimitBytes: STORAGE_LIMITS[user.plan],
      storageLimitLabel: formatBytes(STORAGE_LIMITS[user.plan]),
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
    const shouldCompleteOnboarding = body.completeOnboarding === true;

    if (
      name === undefined &&
      avatarUrl === undefined &&
      !hasAvatar &&
      !shouldCompleteOnboarding
    ) {
      throw badRequest("Nothing to update");
    }
    if (avatarUrl && !/^https?:\/\//i.test(avatarUrl)) {
      throw badRequest("Avatar must be a valid http(s) URL");
    }

    const updated = shouldCompleteOnboarding
      ? await completeOnboarding(user.id)
      : await prisma.user.update({
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
      onboardingCompletedAt: updated.onboardingCompletedAt,
      needsOnboarding: updated.onboardingCompletedAt == null,
    });
  });
}
