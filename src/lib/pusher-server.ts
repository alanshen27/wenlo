import Pusher from "pusher";
import { collabPageChannel } from "@/lib/collab/config";

let pusher: Pusher | null = null;

export function getPusherServer() {
  if (pusher) return pusher;

  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

  if (!appId || !key || !secret || !cluster) {
    throw new Error("Pusher is not configured");
  }

  pusher = new Pusher({
    appId,
    key,
    secret,
    cluster,
    useTLS: true,
  });

  return pusher;
}

export async function broadcastPageYjsUpdate(
  pageId: string,
  update: string,
  originClientId?: number
) {
  await getPusherServer().trigger(collabPageChannel(pageId), "yjs:update", {
    update,
    ...(originClientId !== undefined ? { originClientId } : {}),
  });
}

export async function broadcastPageAwareness(pageId: string, update: string) {
  await getPusherServer().trigger(collabPageChannel(pageId), "yjs:awareness", { update });
}

export async function broadcastPageTitle(pageId: string, title: string) {
  await getPusherServer().trigger(collabPageChannel(pageId), "yjs:title", { title });
}
