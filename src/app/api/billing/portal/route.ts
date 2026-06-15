import { NextResponse } from "next/server";
import { HttpError, notFound, withAuth } from "@/lib/api/http";
import { getBillingSummary } from "@/lib/billing/billing";
import { isBillingConfigured } from "@/lib/billing/lemonsqueezy";

export async function GET() {
  return withAuth(undefined, async ({ user }) => {
    if (!isBillingConfigured()) throw new HttpError(503, "Billing is not configured");

    const billing = await getBillingSummary(user);
    if (!billing.manageUrl) throw notFound("No active subscription to manage");

    return NextResponse.json({ portalUrl: billing.manageUrl });
  });
}
