import { prisma } from "@/lib/db/prisma";
import { notDeleted } from "@/lib/db/filters";
import { getPlan, type PlanId } from "@/lib/billing/plans";

/** Storage caps per plan (bytes). */
export const STORAGE_LIMITS: Record<PlanId, number> = {
  FREE: 1 * 1024 * 1024 * 1024, // 1 GB
  PRO: 50 * 1024 * 1024 * 1024, // 50 GB
};

export type StorageUsage = {
  usedBytes: number;
  limitBytes: number;
  usagePercent: number;
  planId: PlanId;
};

export async function getLibraryStorageUsage(
  libraryId: string,
  planId: PlanId
): Promise<StorageUsage> {
  const agg = await prisma.document.aggregate({
    where: { libraryId, ...notDeleted },
    _sum: { sizeBytes: true },
  });
  const usedBytes = agg._sum.sizeBytes ?? 0;
  const limitBytes = STORAGE_LIMITS[planId];
  const usagePercent = limitBytes > 0 ? Math.min(100, (usedBytes / limitBytes) * 100) : 0;
  return { usedBytes, limitBytes, usagePercent, planId };
}

export async function assertStorageQuota(
  libraryId: string,
  planId: PlanId,
  additionalBytes: number
): Promise<void> {
  const usage = await getLibraryStorageUsage(libraryId, planId);
  if (usage.usedBytes + additionalBytes > usage.limitBytes) {
    const plan = getPlan(planId);
    const err = new Error(
      `Storage limit reached (${formatBytes(usage.usedBytes)} / ${formatBytes(usage.limitBytes)} on ${plan.name}). Upgrade to Pro for more space.`
    );
    (err as Error & { status: number }).status = 413;
    throw err;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}
