import Pusher from "pusher";
import { collabBoardChannel, collabPageChannel } from "@/lib/collab/config";
import type { BoardPatch } from "@/lib/boards/board-schema";
import type { LockHolder } from "@/lib/boards/board-locks";

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

// --- Whiteboards ---

/** Broadcast a merged element patch to other editors (excludes the sender). */
export async function broadcastBoardPatch(
  boardId: string,
  patch: BoardPatch,
  socketId?: string
) {
  await getPusherServer().trigger(collabBoardChannel(boardId), "board:patch", patch, {
    socket_id: socketId,
  });
}

/** Broadcast a lock acquisition (holder set) or release (holder null). */
export async function broadcastBoardLock(
  boardId: string,
  elementIds: string[],
  holder: LockHolder | null,
  socketId?: string
) {
  if (elementIds.length === 0) return;
  await getPusherServer().trigger(
    collabBoardChannel(boardId),
    "board:lock",
    { elementIds, holder },
    { socket_id: socketId }
  );
}
