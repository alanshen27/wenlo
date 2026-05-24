import crypto from "node:crypto";
import type { PlanId } from "./plans";

const API_BASE = "https://api.lemonsqueezy.com/v1";

export type LemonSqueezySubscription = {
  id: string;
  status: string;
  customer_id: number;
  ends_at: string | null;
  cancelled: boolean;
  urls?: {
    customer_portal?: string | null;
    update_payment_method?: string | null;
  };
};

type CheckoutResponse = {
  data: {
    attributes: {
      url: string;
    };
  };
};

type SubscriptionResponse = {
  data: {
    id: string;
    attributes: LemonSqueezySubscription;
  };
};

export function isBillingConfigured() {
  return Boolean(
    process.env.LEMONSQUEEZY_API_KEY &&
      process.env.LEMONSQUEEZY_STORE_ID &&
      process.env.LEMONSQUEEZY_PRO_VARIANT_ID
  );
}

export function appBaseUrl(fallback?: string) {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return fallback || "http://localhost:3000";
}

async function lemonSqueezyFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  if (!apiKey) throw new Error("LEMONSQUEEZY_API_KEY is not configured");

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${apiKey}`,
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Lemon Squeezy API ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

export async function createProCheckout(input: {
  userId: string;
  email: string;
  redirectUrl: string;
}) {
  const storeId = process.env.LEMONSQUEEZY_STORE_ID;
  const variantId = process.env.LEMONSQUEEZY_PRO_VARIANT_ID;
  if (!storeId || !variantId) {
    throw new Error("Lemon Squeezy store or variant is not configured");
  }

  const payload = {
    data: {
      type: "checkouts",
      attributes: {
        checkout_data: {
          email: input.email,
          custom: {
            user_id: input.userId,
          },
        },
        product_options: {
          redirect_url: input.redirectUrl,
        },
      },
      relationships: {
        store: {
          data: { type: "stores", id: storeId },
        },
        variant: {
          data: { type: "variants", id: variantId },
        },
      },
    },
  };

  const response = await lemonSqueezyFetch<CheckoutResponse>("/checkouts", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return response.data.attributes.url;
}

export async function getSubscription(subscriptionId: string) {
  const response = await lemonSqueezyFetch<SubscriptionResponse>(
    `/subscriptions/${subscriptionId}`
  );
  return response.data;
}

export function verifyWebhookSignature(rawBody: string, signature: string | null) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) throw new Error("LEMONSQUEEZY_WEBHOOK_SECRET is not configured");
  if (!signature) return false;

  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const expected = Buffer.from(digest, "utf8");
  const received = Buffer.from(signature, "utf8");

  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(expected, received);
}

export function planFromSubscriptionStatus(status: string): PlanId {
  switch (status) {
    case "active":
    case "on_trial":
    case "past_due":
    case "cancelled":
    case "paused":
      return "PRO";
    default:
      return "FREE";
  }
}

export function subscriptionIsActive(status: string) {
  return planFromSubscriptionStatus(status) === "PRO";
}
