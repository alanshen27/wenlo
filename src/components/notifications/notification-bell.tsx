"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiGet, apiPatch } from "@/lib/client/api";

type Notification = {
  id: string;
  title: string;
  body: string | null;
  read: boolean;
  link: string | null;
  createdAt: string;
};

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const load = useCallback(async () => {
    try {
      const data = await apiGet<{ notifications: Notification[]; unreadCount: number }>(
        "/api/notifications"
      );
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [load]);

  async function markRead(id: string) {
    await apiPatch("/api/notifications", { id });
    await load();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" title="Notifications" className="relative">
            <Bell className="size-4" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-72">
        {notifications.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted-foreground">No notifications</p>
        ) : (
          notifications.slice(0, 8).map((n) => (
            <DropdownMenuItem
              key={n.id}
              className="flex flex-col items-start gap-0.5"
              onClick={() => markRead(n.id)}
            >
              <span className={n.read ? "text-muted-foreground" : "font-medium"}>{n.title}</span>
              {n.body && (
                <span className="text-xs text-muted-foreground line-clamp-2">{n.body}</span>
              )}
              {n.link && (
                <Link href={n.link} className="text-xs text-primary" onClick={(e) => e.stopPropagation()}>
                  Open
                </Link>
              )}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
