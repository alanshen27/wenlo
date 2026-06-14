import { prisma } from "@/lib/db/prisma";
import { formatTokens, getPlan, type PlanId } from "@/lib/billing/plans";

export type UsageSummary = {
  plan: PlanId;
  planName: string;
  tokensUsed: number;
  tokenLimit: number;
  tokensRemaining: number;
  usagePercent: number;
  periodStart: string;
  periodLabel: string;
};

function isNewUsagePeriod(periodStart: Date): boolean {
  const now = new Date();
  return (
    now.getUTCFullYear() !== periodStart.getUTCFullYear() ||
    now.getUTCMonth() !== periodStart.getUTCMonth()
  );
}

function periodLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export async function ensureCurrentUsagePeriod(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { usagePeriodStart: true, tokensUsed: true },
  });

  if (!isNewUsagePeriod(user.usagePeriodStart)) {
    return user;
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      tokensUsed: 0,
      usagePeriodStart: new Date(),
    },
    select: { usagePeriodStart: true, tokensUsed: true },
  });
}

export async function getUsageSummary(userId: string): Promise<UsageSummary> {
  await ensureCurrentUsagePeriod(userId);

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      plan: true,
      tokensUsed: true,
      usagePeriodStart: true,
    },
  });

  const plan = getPlan(user.plan as PlanId);
  const tokensRemaining = Math.max(0, plan.tokenLimit - user.tokensUsed);
  const usagePercent =
    plan.tokenLimit > 0 ? Math.min(100, (user.tokensUsed / plan.tokenLimit) * 100) : 0;

  return {
    plan: plan.id,
    planName: plan.name,
    tokensUsed: user.tokensUsed,
    tokenLimit: plan.tokenLimit,
    tokensRemaining,
    usagePercent,
    periodStart: user.usagePeriodStart.toISOString(),
    periodLabel: periodLabel(user.usagePeriodStart),
  };
}

export async function recordTokenUsage(userId: string, tokens: number) {
  if (tokens <= 0) return;

  await ensureCurrentUsagePeriod(userId);

  await prisma.user.update({
    where: { id: userId },
    data: { tokensUsed: { increment: tokens } },
  });
}

export async function assertWithinTokenLimit(userId: string) {
  const usage = await getUsageSummary(userId);
  if (usage.tokensUsed >= usage.tokenLimit) {
    throw new UsageLimitError(usage);
  }
  return usage;
}

export class UsageLimitError extends Error {
  usage: UsageSummary;

  constructor(usage: UsageSummary) {
    super(
      `Monthly token limit reached (${formatTokens(usage.tokensUsed)} / ${formatTokens(usage.tokenLimit)}). Upgrade to continue using AI features.`
    );
    this.name = "UsageLimitError";
    this.usage = usage;
  }
}
