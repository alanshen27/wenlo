import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { appBaseUrl, createProCheckout, isBillingConfigured } from "@/lib/lemonsqueezy";
import { settingsPlanRoute } from "@/lib/routes";

export async function POST() {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isBillingConfigured()) {
    return NextResponse.json({ error: "Billing is not configured" }, { status: 503 });
  }

  if (user.plan === "PRO" && user.lemonSqueezySubscriptionId) {
    return NextResponse.json({ error: "You already have an active Pro subscription" }, { status: 400 });
  }

  try {
    const checkoutUrl = await createProCheckout({
      userId: user.id,
      email: user.email,
      redirectUrl: `${appBaseUrl()}${settingsPlanRoute()}?checkout=success`,
    });

    return NextResponse.json({ checkoutUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create checkout";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
