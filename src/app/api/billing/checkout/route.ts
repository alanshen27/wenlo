import { NextResponse } from "next/server";
import { badRequest, HttpError, withAuth } from "@/lib/api/http";
import { appBaseUrl, createProCheckout, isBillingConfigured } from "@/lib/billing/lemonsqueezy";
import { settingsPlanRoute } from "@/lib/client/routes";

export async function POST() {
  return withAuth(undefined, async ({ user }) => {
    if (!isBillingConfigured()) throw new HttpError(503, "Billing is not configured");

    if (user.plan === "PRO" && user.lemonSqueezySubscriptionId) {
      throw badRequest("You already have an active Pro subscription");
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
      throw new HttpError(500, message);
    }
  });
}
