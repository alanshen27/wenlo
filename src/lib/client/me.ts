import type { BillingSummary } from "@/lib/billing/billing";
import type { UsageSummary } from "@/lib/billing/usage";
import { queryKeys } from "@/lib/client/query-keys";

export type Me = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  onboardingCompletedAt: string | null;
  needsOnboarding: boolean;
  usage: UsageSummary;
  billing: BillingSummary;
};

export type MeProfile = Pick<Me, "id" | "email" | "name" | "avatarUrl">;

/** @deprecated Use `queryKeys.me` from `@/lib/client/query-keys`. */
export const meQueryKey = queryKeys.me;
