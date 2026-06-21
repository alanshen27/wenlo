import { NextResponse } from "next/server";
import { getRedis } from "@/lib/collab/yjs-store";
import type { PlanId } from "@/lib/billing/plans";

type RateLimitTier = "anonymous" | PlanId;

const LIMITS: Record<RateLimitTier, { windowSec: number; max: number }> = {
  anonymous: { windowSec: 60, max: 10 },
  FREE: { windowSec: 60, max: 30 },
  PRO: { windowSec: 60, max: 120 },
};

export class RateLimitError extends Error {
  retryAfter: number;
  constructor(retryAfter: number) {
    super("Too many requests");
    this.retryAfter = retryAfter;
  }
}

/**
 * Token-bucket style limiter backed by Redis. Falls open when Redis is
 * unavailable so uploads still work in dev without REDIS_URL.
 */
export async function checkRateLimit(
  key: string,
  tier: RateLimitTier
): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
  const { windowSec, max } = LIMITS[tier];

  try {
    const redis = await getRedis();
    const bucketKey = `ratelimit:${key}`;
    const count = await redis.incr(bucketKey);
    if (count === 1) {
      await redis.expire(bucketKey, windowSec);
    }
    if (count > max) {
      const ttl = await redis.ttl(bucketKey);
      return { ok: false, retryAfter: Math.max(ttl, 1) };
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

export function rateLimitResponse(retryAfter: number) {
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfter) },
    }
  );
}

export async function enforceRateLimit(
  userId: string | null,
  plan: PlanId | null,
  route: string
) {
  const tier: RateLimitTier = userId ? (plan ?? "FREE") : "anonymous";
  const key = userId ? `${route}:${userId}` : `${route}:anon`;
  const result = await checkRateLimit(key, tier);
  if (!result.ok) {
    throw new RateLimitError(result.retryAfter);
  }
}
