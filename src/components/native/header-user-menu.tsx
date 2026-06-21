"use client";

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
import { settingsPlanRoute, settingsRoute } from "@/lib/client/routes";
import { userDisplayName, userInitials } from "@/lib/client/user-display";
import { useMe } from "@/hooks/use-me";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

/** Avatar button + account menu shown in the native home header. */
export function HeaderUserMenu() {
  const router = useRouter();
  const { data: me } = useMe();
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
            title={userDisplayName(me.name, me.email)}
            className="shrink-0 rounded-full p-0"
          />
        }
      >
        <Avatar className="size-7">
          {me.avatarUrl && <AvatarImage src={me.avatarUrl} alt="" />}
          <AvatarFallback className="text-[10px] font-medium">
            {userInitials(me.name, me.email)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <div className="flex flex-col gap-0.5 px-2 py-1.5">
          <span className="truncate text-sm font-medium">
            {userDisplayName(me.name, me.email)}
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
