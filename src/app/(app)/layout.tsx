import { requireOnboardedUser } from "@/lib/onboarding/onboarding";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireOnboardedUser();
  return children;
}
