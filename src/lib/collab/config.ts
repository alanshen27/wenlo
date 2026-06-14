export function isCollabConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_PUSHER_KEY &&
      process.env.NEXT_PUBLIC_PUSHER_CLUSTER &&
      process.env.PUSHER_APP_ID &&
      process.env.PUSHER_SECRET &&
      process.env.REDIS_URL
  );
}

/** Client-side check — server-only secrets are validated on API routes. */
export function isCollabClientConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_PUSHER_KEY && process.env.NEXT_PUBLIC_PUSHER_CLUSTER
  );
}

export function collabPageChannel(pageId: string) {
  return `private-page-${pageId}`;
}

/**
 * Whiteboards use a presence channel so Pusher tracks who's currently editing
 * for free (member list = live collaborators). Lock + element-patch events are
 * triggered on the same channel.
 */
export function collabBoardChannel(boardId: string) {
  return `presence-board-${boardId}`;
}

export const YJS_FRAGMENT = "document-store";
export const YJS_ORIGIN_REMOTE = "recall-remote";
