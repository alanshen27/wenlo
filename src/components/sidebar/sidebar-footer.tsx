"use client";

import { useRouter } from "next/navigation";
import { CreditCard, LogOut, Settings, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/blocknote-ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatTokens } from "@/lib/billing/plans";
import { ThemeToggle } from "@/components/theme-toggle";
import { settingsPlanRoute, settingsRoute } from "@/lib/client/routes";
import { userDisplayName, userInitials } from "@/lib/client/user-display";
import { useMe } from "@/hooks/use-me";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/core/utils";
import { useState } from "react";

export function SidebarFooter() {
  const router = useRouter();
  const { data: me, isLoading: loading } = useMe();
  const [loggingOut, setLoggingOut] = useState(false);

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
          {me.avatarUrl && <AvatarImage src={me.avatarUrl} alt="" />}
          <AvatarFallback className="text-[10px] font-medium">
            {userInitials(me.name, me.email)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium leading-tight">
            {userDisplayName(me.name, me.email)}
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
