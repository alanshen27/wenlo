import { redirect } from "next/navigation";
import type { User } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth/auth";
import { libraryHome } from "@/lib/client/routes";
import { listLibrariesWithRoles } from "@/lib/library/libraries";
import { prisma } from "@/lib/db/prisma";

export function needsOnboarding(user: Pick<User, "onboardingCompletedAt">): boolean {
  return user.onboardingCompletedAt == null;
}

export async function completeOnboarding(userId: string): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { onboardingCompletedAt: new Date() },
  });
}

/** Where authenticated users land after login or finishing onboarding. */
export async function getDefaultLibraryHref(userId: string): Promise<string> {
  const libraries = await listLibrariesWithRoles(userId);
  const first = libraries[0];
  if (!first) throw new Error("No library available");
  return libraryHome(first.id);
}

export async function getPostAuthHref(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (needsOnboarding(user)) return "/onboarding";
  return getDefaultLibraryHref(userId);
}

/** Gate library + app routes until first-run onboarding is done. */
export async function requireOnboardedUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (needsOnboarding(user)) redirect("/onboarding");
  return user;
}

/** Onboarding page — bounce completed users to their library. */
export async function requireOnboardingUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!needsOnboarding(user)) {
    redirect(await getDefaultLibraryHref(user.id));
  }
  return user;
}
