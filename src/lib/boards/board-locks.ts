import { WatchError } from "redis";
import { getRedis } from "@/lib/collab/yjs-store";

// Ephemeral per-element edit locks for whiteboards. Locks are pessimistic but
// fine-grained: only the holder may mutate a given element, and different
// elements are independent — so concurrent editors never need a CRDT merge.
// State lives in a single Redis hash per board (field = elementId), with a
// logical TTL (expiresAt) refreshed by heartbeats and a key-level TTL that
// reaps abandoned boards.

export type LockHolder = { userId: string; name: string; color: string };
export type StoredLock = LockHolder & { expiresAt: number };

export const LOCK_TTL_MS = 30_000;
const KEY_TTL_SECONDS = 600;

function locksKey(boardId: string) {
  return `collab:board:${boardId}:locks`;
}

// WATCH is per-connection; serialize hash mutations on the shared client so
// concurrent acquires on the same board don't clobber each other.
const queues = new Map<string, Promise<unknown>>();
function serialize<T>(boardId: string, fn: () => Promise<T>): Promise<T> {
  const tail = queues.get(boardId) ?? Promise.resolve();
  const run = tail.catch(() => undefined).then(fn);
  queues.set(boardId, run);
  void run.finally(() => {
    if (queues.get(boardId) === run) queues.delete(boardId);
  });
  return run;
}

function parse(raw: string | undefined): StoredLock | null {
  if (!raw) return null;
  try {
    const lock = JSON.parse(raw) as StoredLock;
    if (lock.expiresAt <= Date.now()) return null;
    return lock;
  } catch {
    return null;
  }
}

export type AcquireResult = {
  granted: string[];
  denied: { elementId: string; holder: LockHolder }[];
};

/** Acquire or heartbeat locks for the given elements. Idempotent for the owner. */
export async function acquireLocks(
  boardId: string,
  elementIds: string[],
  holder: LockHolder,
  ttlMs = LOCK_TTL_MS
): Promise<AcquireResult> {
  if (elementIds.length === 0) return { granted: [], denied: [] };
  const key = locksKey(boardId);

  return serialize(boardId, async () => {
    const redis = await getRedis();
    for (let attempt = 0; attempt < 12; attempt++) {
      try {
        await redis.watch(key);
        const existing = await redis.hGetAll(key);

        const granted: string[] = [];
        const denied: { elementId: string; holder: LockHolder }[] = [];
        const writes: Record<string, string> = {};
        const expiresAt = Date.now() + ttlMs;

        for (const elementId of elementIds) {
          const current = parse(existing[elementId]);
          if (current && current.userId !== holder.userId) {
            denied.push({
              elementId,
              holder: { userId: current.userId, name: current.name, color: current.color },
            });
            continue;
          }
          granted.push(elementId);
          writes[elementId] = JSON.stringify({ ...holder, expiresAt } satisfies StoredLock);
        }

        if (granted.length === 0) {
          await redis.unwatch();
          return { granted, denied };
        }

        const tx = redis.multi().hSet(key, writes).expire(key, KEY_TTL_SECONDS);
        await tx.exec();
        return { granted, denied };
      } catch (error) {
        if (error instanceof WatchError) continue;
        throw error;
      }
    }
    throw new Error("Failed to acquire board locks");
  });
}

/** Release locks held by the user; ignores elements held by someone else. */
export async function releaseLocks(
  boardId: string,
  elementIds: string[],
  userId: string
): Promise<string[]> {
  if (elementIds.length === 0) return [];
  const key = locksKey(boardId);

  return serialize(boardId, async () => {
    const redis = await getRedis();
    const existing = await redis.hGetAll(key);
    const toDelete = elementIds.filter((id) => {
      const current = parse(existing[id]);
      return current && current.userId === userId;
    });
    if (toDelete.length > 0) await redis.hDel(key, toDelete);
    return toDelete;
  });
}

/** Current (non-expired) locks for a board, keyed by element id. */
export async function listLocks(boardId: string): Promise<Record<string, LockHolder>> {
  const redis = await getRedis();
  const existing = await redis.hGetAll(locksKey(boardId));
  const result: Record<string, LockHolder> = {};
  const stale: string[] = [];
  for (const [elementId, raw] of Object.entries(existing)) {
    const lock = parse(raw);
    if (lock) result[elementId] = { userId: lock.userId, name: lock.name, color: lock.color };
    else stale.push(elementId);
  }
  if (stale.length > 0) {
    await redis.hDel(locksKey(boardId), stale).catch(() => {});
  }
  return result;
}
