import { LandingPage } from "@/components/views/landing-page";

type LandingViewProps = {
  isLoggedIn?: boolean;
  libraryHref?: string | null;
};

export function LandingView({ isLoggedIn = false, libraryHref }: LandingViewProps) {
  return <LandingPage isLoggedIn={isLoggedIn} libraryHref={libraryHref} />;
}
