import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { isCollabConfigured } from "@/lib/collab/config";
import { authorizePusherChannel } from "@/lib/collab/pusher-auth";
import { LibraryAccessError } from "@/lib/library-access";

export async function POST(req: NextRequest) {
  if (!isCollabConfigured()) {
    return NextResponse.json({ error: "Collaboration is not configured" }, { status: 503 });
  }

  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const body = await req.formData().catch(() => null);
  const jsonBody = body ? null : await req.json().catch(() => null);

  const socketId =
    (body?.get("socket_id") as string | null) ??
    (jsonBody?.socket_id as string | undefined) ??
    req.nextUrl.searchParams.get("socket_id");
  const channelName =
    (body?.get("channel_name") as string | null) ??
    (jsonBody?.channel_name as string | undefined) ??
    req.nextUrl.searchParams.get("channel_name");

  if (!socketId || !channelName) {
    return NextResponse.json({ error: "Missing socket_id or channel_name" }, { status: 400 });
  }

  try {
    const auth = await authorizePusherChannel(user.id, channelName, socketId);
    return NextResponse.json(auth);
  } catch (error) {
    if (error instanceof LibraryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
