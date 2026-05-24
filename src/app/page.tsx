import { getCurrentUser } from "@/lib/auth";
import { RedirectToLibrary } from "@/components/library/redirect-to-library";
import { LandingView } from "@/components/views/landing-view";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) return <LandingView />;

  return <RedirectToLibrary />;
}
