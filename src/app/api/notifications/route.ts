import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/http";
import {
  countUnreadNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications/notifications";

export async function GET() {
  return withAuth(undefined, async ({ user }) => {
    const [notifications, unreadCount] = await Promise.all([
      listNotifications(user.id),
      countUnreadNotifications(user.id),
    ]);
    return NextResponse.json({ notifications, unreadCount });
  });
}

export async function PATCH(req: NextRequest) {
  return withAuth(undefined, async ({ user }) => {
    const body = await req.json();
    if (body.markAll) {
      await markAllNotificationsRead(user.id);
      return NextResponse.json({ ok: true });
    }
    if (typeof body.id === "string") {
      await markNotificationRead(user.id, body.id);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  });
}
