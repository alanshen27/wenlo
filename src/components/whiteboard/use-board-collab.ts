"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PusherClient, { type PresenceChannel } from "pusher-js";
import { collabBoardChannel, isCollabClientConfigured } from "@/lib/collab/config";
import type { PageCollaborator } from "@/lib/realtime/page-presence";
import type { BoardPatch } from "@/lib/boards/board-schema";
import { apiClient, apiGet, apiPost } from "@/lib/client/api";

export type LockHolder = { userId: string; name: string; color: string };
export type LockMap = Record<string, LockHolder>;

type AcquireResult = { granted: string[]; denied: { elementId: string; holder: LockHolder }[] };

type MemberInfo = { name: string; email: string; color: string };
type PresenceMember = { id: string; info: MemberInfo };

const HEARTBEAT_MS = 15_000;

export type BoardCollab = {
  enabled: boolean;
  collaborators: PageCollaborator[];
  /** Locks held by *other* users, keyed by element id. */
  remoteLocks: LockMap;
  /** Acquire/heartbeat locks; resolves with which ids were granted/denied. */
  acquireLocks: (elementIds: string[]) => Promise<AcquireResult>;
  releaseLocks: (elementIds: string[]) => void;
  /** Current Pusher socket id, so server can exclude us from our own echoes. */
  getSocketId: () => string | undefined;
};

export function useBoardCollab({
  boardId,
  currentUserId,
  enabled: enabledProp,
  onRemotePatch,
}: {
  boardId: string;
  currentUserId: string | null;
  enabled: boolean;
  onRemotePatch: (patch: BoardPatch) => void;
}): BoardCollab {
  const enabled = enabledProp && isCollabClientConfigured() && Boolean(currentUserId);

  const [collaborators, setCollaborators] = useState<PageCollaborator[]>([]);
  const [remoteLocks, setRemoteLocks] = useState<LockMap>({});

  const socketIdRef = useRef<string | undefined>(undefined);
  const heldRef = useRef<Set<string>>(new Set());
  const patchHandlerRef = useRef(onRemotePatch);
  useEffect(() => {
    patchHandlerRef.current = onRemotePatch;
  }, [onRemotePatch]);

  // --- Realtime subscription ---
  useEffect(() => {
    if (!enabled) {
      setCollaborators([]);
      setRemoteLocks({});
      return;
    }

    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!key || !cluster) return;

    let cancelled = false;
    const pusher = new PusherClient(key, { cluster, authEndpoint: "/api/pusher/auth" });
    pusher.connection.bind("connected", () => {
      socketIdRef.current = pusher.connection.socket_id;
    });

    const channelName = collabBoardChannel(boardId);
    const channel = pusher.subscribe(channelName) as PresenceChannel;

    const toCollaborator = (m: PresenceMember): PageCollaborator => ({
      userId: m.id,
      name: m.info?.name ?? "Someone",
      email: m.info?.email ?? "",
    });

    channel.bind("pusher:subscription_succeeded", () => {
      const others: PageCollaborator[] = [];
      channel.members.each((m: PresenceMember) => {
        if (m.id !== currentUserId) others.push(toCollaborator(m));
      });
      if (!cancelled) setCollaborators(others);
    });
    channel.bind("pusher:member_added", (m: PresenceMember) => {
      if (m.id === currentUserId) return;
      setCollaborators((prev) =>
        prev.some((c) => c.userId === m.id) ? prev : [...prev, toCollaborator(m)]
      );
    });
    channel.bind("pusher:member_removed", (m: PresenceMember) => {
      setCollaborators((prev) => prev.filter((c) => c.userId !== m.id));
      // Their locks are now stale; drop immediately (TTL would also reap them).
      setRemoteLocks((prev) => {
        const next: LockMap = {};
        for (const [id, holder] of Object.entries(prev)) {
          if (holder.userId !== m.id) next[id] = holder;
        }
        return next;
      });
    });

    channel.bind("board:patch", (patch: BoardPatch) => {
      patchHandlerRef.current(patch);
    });
    channel.bind(
      "board:lock",
      ({ elementIds, holder }: { elementIds: string[]; holder: LockHolder | null }) => {
        setRemoteLocks((prev) => {
          const next = { ...prev };
          for (const id of elementIds) {
            if (holder && holder.userId !== currentUserId) next[id] = holder;
            else delete next[id];
          }
          return next;
        });
      }
    );

    // Seed with whatever locks already exist.
    apiGet<{ locks: LockMap }>(`/api/boards/${boardId}/locks`)
      .then(({ locks }) => {
        if (cancelled) return;
        const others: LockMap = {};
        for (const [id, holder] of Object.entries(locks)) {
          if (holder.userId !== currentUserId) others[id] = holder;
        }
        setRemoteLocks((prev) => ({ ...others, ...prev }));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      channel.unbind_all();
      pusher.unsubscribe(channelName);
      pusher.disconnect();
      socketIdRef.current = undefined;
    };
  }, [enabled, boardId, currentUserId]);

  // --- Heartbeat held locks ---
  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => {
      const ids = Array.from(heldRef.current);
      if (ids.length === 0) return;
      void apiPost(`/api/boards/${boardId}/locks`, {
        elementIds: ids,
        socketId: socketIdRef.current,
      }).catch(() => {});
    }, HEARTBEAT_MS);
    return () => clearInterval(interval);
  }, [enabled, boardId]);

  const acquireLocks = useCallback(
    async (elementIds: string[]): Promise<AcquireResult> => {
      if (elementIds.length === 0) return { granted: [], denied: [] };
      if (!enabled) {
        for (const id of elementIds) heldRef.current.add(id);
        return { granted: elementIds, denied: [] };
      }
      try {
        const result = await apiPost<AcquireResult>(`/api/boards/${boardId}/locks`, {
          elementIds,
          socketId: socketIdRef.current,
        });
        for (const id of result.granted) heldRef.current.add(id);
        return result;
      } catch {
        return { granted: [], denied: [] };
      }
    },
    [enabled, boardId]
  );

  const releaseLocks = useCallback(
    (elementIds: string[]) => {
      if (elementIds.length === 0) return;
      for (const id of elementIds) heldRef.current.delete(id);
      if (!enabled) return;
      void apiClient
        .delete(`/api/boards/${boardId}/locks`, {
          data: { elementIds, socketId: socketIdRef.current },
        })
        .catch(() => {});
    },
    [enabled, boardId]
  );

  const getSocketId = useCallback(() => socketIdRef.current, []);

  return { enabled, collaborators, remoteLocks, acquireLocks, releaseLocks, getSocketId };
}
