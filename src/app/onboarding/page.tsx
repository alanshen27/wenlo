import { OnboardingView } from "@/components/views/onboarding-view";
import { requireOnboardingUser } from "@/lib/onboarding/onboarding";

export default async function OnboardingPage() {
  await requireOnboardingUser();
  return <OnboardingView />;
}
