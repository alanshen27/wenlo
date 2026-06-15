"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, LogOut, Settings, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/blocknote-ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiGet } from "@/lib/client/api";
import { settingsPlanRoute, settingsRoute } from "@/lib/client/routes";
import { createClient } from "@/lib/supabase/client";

type Me = {
  email: string;
  name: string | null;
  avatarUrl: string | null;
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

/** Avatar button + account menu shown in the native home header. */
export function HeaderUserMenu() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiGet<Me>("/api/me");
        if (!cancelled) setMe(data);
      } catch {
        if (!cancelled) setMe(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  if (!me) {
    return <div className="size-7 shrink-0 animate-pulse rounded-full bg-sidebar-accent" />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Account"
            title={displayName(me.name, me.email)}
            className="shrink-0 rounded-full p-0"
          />
        }
      >
        <Avatar className="size-7">
          {me.avatarUrl && <AvatarImage src={me.avatarUrl} alt="" />}
          <AvatarFallback className="text-[10px] font-medium">
            {initials(me.name, me.email)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <div className="flex flex-col gap-0.5 px-2 py-1.5">
          <span className="truncate text-sm font-medium">
            {displayName(me.name, me.email)}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {me.email}
          </span>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push(settingsRoute())}>
          <User className="size-3.5" />
          Account
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(settingsPlanRoute())}>
          <CreditCard className="size-3.5" />
          Plan & billing
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={loggingOut} onClick={handleLogout}>
          <LogOut className="size-3.5" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
