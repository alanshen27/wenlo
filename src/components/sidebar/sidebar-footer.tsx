"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, LogOut, Settings, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/blocknote-ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatTokens } from "@/lib/plans";
import { ThemeToggle } from "@/components/theme-toggle";
import { apiGet } from "@/lib/api";
import { settingsPlanRoute, settingsRoute } from "@/lib/routes";
import type { UsageSummary } from "@/lib/usage";
import { USAGE_UPDATED_EVENT } from "@/lib/usage-events";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type MeResponse = {
  id: string;
  email: string;
  name: string | null;
  usage: UsageSummary;
};

function initials(name: string | null, email: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function displayName(name: string | null, email: string): string {
  return name?.trim() || email.split("@")[0];
}

export function SidebarFooter() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const loadMe = useCallback(async () => {
    try {
      const data = await apiGet<MeResponse>("/api/me");
      setMe(data);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMe();
    const onUsageUpdated = () => void loadMe();
    window.addEventListener(USAGE_UPDATED_EVENT, onUsageUpdated);
    return () => window.removeEventListener(USAGE_UPDATED_EVENT, onUsageUpdated);
  }, [loadMe]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <div className="border-t border-sidebar-border px-3 py-3">
        <div className="h-14 animate-pulse rounded-md bg-muted/60" />
      </div>
    );
  }

  if (!me) {
    return (
      <div className="border-t border-sidebar-border px-3 py-3">
        <Button variant="outline" className="w-full" onClick={() => router.push("/login")}>
          Sign in
        </Button>
      </div>
    );
  }

  const { usage } = me;
  const nearLimit = usage.usagePercent >= 80;
  const atLimit = usage.tokensUsed >= usage.tokenLimit;

  return (
    <div className="border-t border-sidebar-border">
      <div className="space-y-1.5 px-3 py-3">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>AI tokens</span>
          <span className={cn(atLimit && "text-destructive", nearLimit && !atLimit && "text-amber-600")}>
            {formatTokens(usage.tokensUsed)} / {formatTokens(usage.tokenLimit)}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              atLimit ? "bg-destructive" : nearLimit ? "bg-amber-500" : "bg-primary"
            )}
            style={{ width: `${usage.usagePercent}%` }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground">Resets {usage.periodLabel}</p>
      </div>

      <div className="flex items-center gap-2 border-t border-sidebar-border px-2 py-2">
        <Avatar className="size-7 shrink-0">
          <AvatarFallback className="text-[10px] font-medium">
            {initials(me.name, me.email)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium leading-tight">
            {displayName(me.name, me.email)}
          </p>
          <p className="truncate text-[10px] text-muted-foreground">{me.email}</p>
        </div>
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" title="Settings">
                <Settings className="size-3.5" />
              </Button>
            }
          />
          <DropdownMenuContent side="top" align="end" className="w-44">
            <DropdownMenuItem onClick={() => router.push(settingsRoute())}>
              <User className="size-3.5" />
              Account
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push(settingsPlanRoute())}>
              <CreditCard className="size-3.5" />
              Plan & billing
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Sign out"
          disabled={loggingOut}
          onClick={handleLogout}
        >
          <LogOut className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
