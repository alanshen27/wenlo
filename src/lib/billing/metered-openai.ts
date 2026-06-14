import { assertWithinTokenLimit, recordTokenUsage } from "@/lib/billing/usage";

/**
 * Centralized token metering for OpenAI calls. Wrap the choke-point helpers
 * (`embedText`, `embedTexts`, `extractWithOpenAI`, chat completions) with these
 * so every model call is gated against the user's quota and charged afterwards,
 * instead of scattering billing logic across each route.
 *
 * Passing `userId` as null/undefined makes these no-ops, so internal/system
 * calls that have no user to bill simply skip metering.
 */

/** Any OpenAI response shape that carries token usage (chat, embeddings, responses). */
export type UsageCarrier = {
  usage?: { total_tokens?: number | null } | null;
};

/** Read the total token count off any OpenAI response shape (0 when absent). */
export function usageTokens(response: UsageCarrier | null | undefined): number {
  return response?.usage?.total_tokens ?? 0;
}

/**
 * Gate an AI operation against the user's monthly quota before spending money.
 * Throws `UsageLimitError` when the user is over their limit.
 */
export async function gateUsage(userId: string | null | undefined): Promise<void> {
  if (!userId) return;
  await assertWithinTokenLimit(userId);
}

/** Charge the user for the tokens reported by an OpenAI response. */
export async function chargeUsage(
  userId: string | null | undefined,
  response: UsageCarrier | null | undefined
): Promise<void> {
  if (!userId) return;
  await recordTokenUsage(userId, usageTokens(response));
}
