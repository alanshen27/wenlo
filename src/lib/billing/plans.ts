export type PlanId = "FREE" | "PRO";

export type PlanDefinition = {
  id: PlanId;
  name: string;
  tokenLimit: number;
  description: string;
  priceLabel: string;
  features: string[];
};

export const PLANS: Record<PlanId, PlanDefinition> = {
  FREE: {
    id: "FREE",
    name: "Free",
    tokenLimit: 50_000,
    description: "For getting started",
    priceLabel: "$0",
    features: [
      "50k AI tokens per month",
      "Unlimited libraries & pages",
      "Semantic + keyword search",
    ],
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    tokenLimit: 500_000,
    description: "For power users",
    priceLabel: "$12",
    features: [
      "500k AI tokens per month",
      "Everything in Free",
      "Priority support (coming soon)",
    ],
  },
};

export const PLAN_LIST: PlanDefinition[] = [PLANS.FREE, PLANS.PRO];

export function getPlan(planId: PlanId): PlanDefinition {
  return PLANS[planId] ?? PLANS.FREE;
}

export function formatTokens(count: number): string {
  if (count >= 1_000_000) {
    const value = count / 1_000_000;
    return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}M`;
  }
  if (count >= 1_000) {
    const value = count / 1_000;
    return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}k`;
  }
  return count.toLocaleString();
}
