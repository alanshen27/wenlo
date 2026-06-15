import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/auth";
import { getPostAuthHref } from "@/lib/onboarding/onboarding";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) {
    redirect(await getPostAuthHref(user.id));
  }

  const { LandingView } = await import("@/components/views/landing-view");
  return <LandingView isLoggedIn={false} libraryHref={null} />;
}
