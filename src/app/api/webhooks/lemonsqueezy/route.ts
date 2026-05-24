import { NextResponse } from "next/server";
import { syncSubscriptionWebhook } from "@/lib/billing";
import { verifyWebhookSignature } from "@/lib/lemonsqueezy";

export const runtime = "nodejs";

type WebhookPayload = {
  meta?: {
    event_name?: string;
    custom_data?: { user_id?: string | number };
  };
  data?: {
    id?: string;
    type?: string;
    attributes?: {
      status?: string;
      customer_id?: number;
      user_email?: string;
      ends_at?: string | null;
      cancelled?: boolean;
      urls?: {
        customer_portal?: string | null;
      };
    };
  };
};

const SUBSCRIPTION_EVENTS = new Set([
  "subscription_created",
  "subscription_updated",
  "subscription_cancelled",
  "subscription_resumed",
  "subscription_expired",
  "subscription_payment_failed",
  "subscription_payment_success",
]);

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-signature");

  try {
    if (!verifyWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 503 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventName = payload.meta?.event_name;
  if (!eventName || !SUBSCRIPTION_EVENTS.has(eventName)) {
    return NextResponse.json({ received: true });
  }

  if (payload.data?.type !== "subscriptions" || !payload.data.attributes?.status) {
    return NextResponse.json({ received: true });
  }

  try {
    await syncSubscriptionWebhook(payload);
  } catch (error) {
    console.error("Lemon Squeezy webhook error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
