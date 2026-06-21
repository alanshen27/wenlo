"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatTokens, PLAN_LIST, type PlanDefinition, type PlanId } from "@/lib/billing/plans";
import { libraryHome, readStoredLibraryId } from "@/lib/client/routes";
import { apiGet, apiPost, getApiErrorMessage } from "@/lib/client/api";
import { USAGE_UPDATED_EVENT } from "@/lib/billing/usage-events";
import { useInvalidateMe, useMe } from "@/hooks/use-me";
import { cn } from "@/lib/core/utils";

export function PlanSettingsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const checkoutSuccess = searchParams.get("checkout") === "success";
  const { data: me, isLoading: loading, isError } = useMe();
  const invalidateMe = useInvalidateMe();
  const [acting, setActing] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isError) router.push("/login");
  }, [isError, router]);

  useEffect(() => {
    if (!checkoutSuccess) return;
    setNotice("Payment received. Your plan will update in a few seconds.");
    invalidateMe();
    window.dispatchEvent(new Event(USAGE_UPDATED_EVENT));
  }, [checkoutSuccess, invalidateMe]);

  async function startCheckout() {
    setActing("PRO");
    setError(null);

    try {
      const data = await apiPost<{ checkoutUrl: string }>("/api/billing/checkout");
      window.location.href = data.checkoutUrl;
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to start checkout"));
      setActing(null);
    }
  }

  async function openPortal() {
    setActing("FREE");
    setError(null);

    try {
      const data = await apiGet<{ portalUrl: string }>("/api/billing/portal");
      window.location.href = data.portalUrl;
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to open billing portal"));
      setActing(null);
    }
  }

  function handlePlanAction(planId: PlanId) {
    if (!me || me.usage.plan === planId || acting) return;

    if (planId === "PRO") {
      void startCheckout();
      return;
    }

    void openPortal();
  }

  const backHref = (() => {
    const libraryId = readStoredLibraryId();
    return libraryId ? libraryHome(libraryId) : "/";
  })();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading plans…</p>
      </div>
    );
  }

  if (!me) return null;

  const { usage, billing } = me;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 md:px-10">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back
          </Link>
        </div>
      </header>

      <main className="px-6 py-10 md:px-10">
        <div className="mx-auto max-w-3xl space-y-8">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="size-4" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">Plans</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Upgrade to Pro for more AI tokens. Payments are handled securely by Lemon Squeezy.
            </p>
          </div>

          {notice && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
              {notice}
            </div>
          )}

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Current usage</p>
                <p className="text-xs text-muted-foreground">Resets {usage.periodLabel}</p>
              </div>
              <Badge variant={usage.plan === "PRO" ? "default" : "secondary"}>{usage.planName}</Badge>
            </div>
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>AI tokens</span>
                <span>
                  {formatTokens(usage.tokensUsed)} / {formatTokens(usage.tokenLimit)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${usage.usagePercent}%` }}
                />
              </div>
            </div>
            {billing.cancelAtPeriodEnd && (
              <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                Pro cancels at the end of your billing period. You keep access until then.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {PLAN_LIST.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                current={usage.plan === plan.id}
                acting={acting === plan.id}
                disabled={acting !== null}
                billingConfigured={billing.configured}
                onSelect={() => handlePlanAction(plan.id)}
              />
            ))}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <p className="text-xs text-muted-foreground">
            Signed in as {me.email}. To cancel Pro, use Manage subscription — access continues until
            the period ends. Tax and invoices are handled by Lemon Squeezy.
          </p>
        </div>
      </main>
    </div>
  );
}

function PlanCard({
  plan,
  current,
  acting,
  disabled,
  billingConfigured,
  onSelect,
}: {
  plan: PlanDefinition;
  current: boolean;
  acting: boolean;
  disabled: boolean;
  billingConfigured: boolean;
  onSelect: () => void;
}) {
  const isPro = plan.id === "PRO";

  let actionLabel = "Select plan";
  if (acting) actionLabel = "Redirecting…";
  else if (current) actionLabel = "Current plan";
  else if (isPro) actionLabel = billingConfigured ? "Upgrade to Pro" : "Billing not configured";
  else actionLabel = "Manage subscription";

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border p-5",
        current ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border bg-card"
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">{plan.name}</h2>
          <p className="text-xs text-muted-foreground">{plan.description}</p>
        </div>
        {current && (
          <Badge variant="outline" className="shrink-0">
            Current
          </Badge>
        )}
      </div>

      <p className="mb-4">
        <span className="text-3xl font-semibold tracking-tight">{plan.priceLabel}</span>
        <span className="text-sm text-muted-foreground">/mo</span>
      </p>

      <ul className="mb-6 flex-1 space-y-2">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <Button
        variant={current ? "outline" : isPro ? "default" : "secondary"}
        disabled={current || disabled || (isPro && !billingConfigured)}
        onClick={onSelect}
      >
        {actionLabel}
      </Button>
    </div>
  );
}
