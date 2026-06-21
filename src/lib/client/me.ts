import type { BillingSummary } from "@/lib/billing/billing";
import type { UsageSummary } from "@/lib/billing/usage";
import type { PlanId } from "@/lib/billing/plans";
import { queryKeys } from "@/lib/client/query-keys";

export type LibraryStorageUsage = {
  libraryId: string;
  libraryName: string;
  usedBytes: number;
  limitBytes: number;
  usagePercent: number;
  planId: PlanId;
};

export type Me = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  plan: PlanId;
  onboardingCompletedAt: string | null;
  needsOnboarding: boolean;
  usage: UsageSummary;
  billing: BillingSummary;
  storage: LibraryStorageUsage[];
  storageLimitBytes: number;
  storageLimitLabel: string;
};

export type MeProfile = Pick<Me, "id" | "email" | "name" | "avatarUrl">;

/** @deprecated Use `queryKeys.me` from `@/lib/client/query-keys`. */
export const meQueryKey = queryKeys.me;
