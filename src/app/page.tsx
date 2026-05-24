import { LandingView } from "@/components/views/landing-view";
import { getCurrentUser } from "@/lib/auth";
import { listLibrariesWithRoles } from "@/lib/libraries";
import { libraryHome } from "@/lib/routes";

export default async function HomePage() {
  const user = await getCurrentUser();
  let libraryHref: string | null = null;

  if (user) {
    const libraries = await listLibrariesWithRoles(user.id);
    if (libraries[0]) libraryHref = libraryHome(libraries[0].id);
  }

  return <LandingView isLoggedIn={!!user} libraryHref={libraryHref} />;
}
