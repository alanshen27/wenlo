import { prisma } from "./prisma";
import {
  getSubscription,
  isBillingConfigured,
  planFromSubscriptionStatus,
  type LemonSqueezySubscription,
} from "./lemonsqueezy";
import type { PlanId } from "./plans";

export type BillingSummary = {
  configured: boolean;
  subscriptionId: string | null;
  subscriptionStatus: string | null;
  cancelAtPeriodEnd: boolean;
  manageUrl: string | null;
};

export async function getBillingSummary(user: {
  id: string;
  lemonSqueezySubscriptionId: string | null;
}): Promise<BillingSummary> {
  const base: BillingSummary = {
    configured: isBillingConfigured(),
    subscriptionId: user.lemonSqueezySubscriptionId,
    subscriptionStatus: null,
    cancelAtPeriodEnd: false,
    manageUrl: null,
  };

  if (!user.lemonSqueezySubscriptionId || !isBillingConfigured()) {
    return base;
  }

  try {
    const subscription = await getSubscription(user.lemonSqueezySubscriptionId);
    const attrs = subscription.attributes;

    return {
      ...base,
      subscriptionStatus: attrs.status,
      cancelAtPeriodEnd: attrs.cancelled || attrs.status === "cancelled",
      manageUrl: attrs.urls?.customer_portal ?? null,
    };
  } catch {
    return base;
  }
}

export async function applySubscriptionToUser(
  userId: string,
  subscription: LemonSqueezySubscription
) {
  const plan = planFromSubscriptionStatus(subscription.status);

  await prisma.user.update({
    where: { id: userId },
    data: {
      plan,
      lemonSqueezyCustomerId: String(subscription.customer_id),
      lemonSqueezySubscriptionId: subscription.id,
    },
  });

  return plan;
}

export async function downgradeUserToFree(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      plan: "FREE" satisfies PlanId,
    },
  });
}

export async function findUserForWebhook(input: {
  userId?: string | number | null;
  email?: string | null;
  subscriptionId?: string | null;
}) {
  if (input.userId) {
    const user = await prisma.user.findUnique({ where: { id: String(input.userId) } });
    if (user) return user;
  }

  if (input.subscriptionId) {
    const user = await prisma.user.findFirst({
      where: { lemonSqueezySubscriptionId: input.subscriptionId },
    });
    if (user) return user;
  }

  if (input.email) {
    return prisma.user.findUnique({ where: { email: input.email } });
  }

  return null;
}

export async function syncSubscriptionWebhook(payload: {
  meta?: { custom_data?: { user_id?: string | number } };
  data?: {
    id?: string;
    attributes?: Partial<LemonSqueezySubscription> & {
      user_email?: string;
      customer_id?: number;
    };
  };
}) {
  const attrs = payload.data?.attributes;
  if (!attrs?.status || !payload.data?.id) {
    throw new Error("Invalid subscription webhook payload");
  }

  const subscriptionId = payload.data.id;
  const fullSubscription: LemonSqueezySubscription = {
    id: subscriptionId,
    status: attrs.status,
    customer_id: attrs.customer_id ?? 0,
    ends_at: attrs.ends_at ?? null,
    cancelled: attrs.cancelled ?? false,
    urls: attrs.urls,
  };

  const user = await findUserForWebhook({
    userId: payload.meta?.custom_data?.user_id,
    email: attrs.user_email,
    subscriptionId,
  });

  if (!user) {
    throw new Error("No user found for subscription webhook");
  }

  if (attrs.status === "expired" || attrs.status === "unpaid") {
    await downgradeUserToFree(user.id);
    await prisma.user.update({
      where: { id: user.id },
      data: { lemonSqueezySubscriptionId: null },
    });
    return user.id;
  }

  await applySubscriptionToUser(user.id, fullSubscription);
  return user.id;
}
