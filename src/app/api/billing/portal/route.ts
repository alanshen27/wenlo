import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getBillingSummary } from "@/lib/billing";
import { isBillingConfigured } from "@/lib/lemonsqueezy";

export async function GET() {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isBillingConfigured()) {
    return NextResponse.json({ error: "Billing is not configured" }, { status: 503 });
  }

  const billing = await getBillingSummary(user);
  if (!billing.manageUrl) {
    return NextResponse.json({ error: "No active subscription to manage" }, { status: 404 });
  }

  return NextResponse.json({ portalUrl: billing.manageUrl });
}
