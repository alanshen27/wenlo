"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PusherClient, { type PresenceChannel } from "pusher-js";
import { collabBoardChannel, isCollabClientConfigured } from "@/lib/collab/config";
import { colorForUser } from "@/lib/collab/user-colors";
import type { PageCollaborator } from "@/lib/realtime/page-presence";
import type { BoardPatch } from "@/lib/boards/board-schema";
import { apiClient, apiGet, apiPost } from "@/lib/client/api";

export type LockHolder = { userId: string; name: string; color: string };
export type LockMap = Record<string, LockHolder>;

/** A collaborator's live pointer position, in board (scene) coordinates. */
export type RemoteCursor = { userId: string; name: string; color: string; x: number; y: number };

type AcquireResult = { granted: string[]; denied: { elementId: string; holder: LockHolder }[] };

type MemberInfo = { name: string; email: string; color: string };
type PresenceMember = { id: string; info: MemberInfo };

type CursorEvent = { userId: string; x?: number; y?: number; gone?: boolean };

const HEARTBEAT_MS = 15_000;
/** Drop a remote cursor if we haven't heard from it in this long (ms). */
const CURSOR_STALE_MS = 5_000;
const CLIENT_POINTER_EVENT = "client-pointer";

export type BoardCollab = {
  enabled: boolean;
  collaborators: PageCollaborator[];
  /** Locks held by *other* users, keyed by element id. */
  remoteLocks: LockMap;
  /** Live pointer positions of other users, in scene coordinates. */
  remoteCursors: RemoteCursor[];
  /** Acquire/heartbeat locks; resolves with which ids were granted/denied. */
  acquireLocks: (elementIds: string[]) => Promise<AcquireResult>;
  releaseLocks: (elementIds: string[]) => void;
  /** Broadcast our pointer position (scene coords), or null when it leaves the canvas. */
  publishCursor: (pos: { x: number; y: number } | null) => void;
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
  const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursor & { ts: number }>>(
    {}
  );

  const socketIdRef = useRef<string | undefined>(undefined);
  const heldRef = useRef<Set<string>>(new Set());
  const channelRef = useRef<PresenceChannel | null>(null);
  const membersRef = useRef<Record<string, { name: string; color: string }>>({});
  const patchHandlerRef = useRef(onRemotePatch);
  useEffect(() => {
    patchHandlerRef.current = onRemotePatch;
  }, [onRemotePatch]);

  // --- Realtime subscription ---
  useEffect(() => {
    if (!enabled) {
      setCollaborators([]);
      setRemoteLocks({});
      setRemoteCursors({});
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
    channelRef.current = channel;

    const toCollaborator = (m: PresenceMember): PageCollaborator => ({
      userId: m.id,
      name: m.info?.name ?? "Someone",
      email: m.info?.email ?? "",
    });
    const rememberMember = (m: PresenceMember) => {
      membersRef.current[m.id] = {
        name: m.info?.name ?? "Someone",
        color: m.info?.color ?? colorForUser(m.id),
      };
    };

    channel.bind("pusher:subscription_succeeded", () => {
      const others: PageCollaborator[] = [];
      channel.members.each((m: PresenceMember) => {
        rememberMember(m);
        if (m.id !== currentUserId) others.push(toCollaborator(m));
      });
      if (!cancelled) setCollaborators(others);
    });
    channel.bind("pusher:member_added", (m: PresenceMember) => {
      rememberMember(m);
      if (m.id === currentUserId) return;
      setCollaborators((prev) =>
        prev.some((c) => c.userId === m.id) ? prev : [...prev, toCollaborator(m)]
      );
    });
    channel.bind("pusher:member_removed", (m: PresenceMember) => {
      delete membersRef.current[m.id];
      setCollaborators((prev) => prev.filter((c) => c.userId !== m.id));
      // Their locks are now stale; drop immediately (TTL would also reap them).
      setRemoteLocks((prev) => {
        const next: LockMap = {};
        for (const [id, holder] of Object.entries(prev)) {
          if (holder.userId !== m.id) next[id] = holder;
        }
        return next;
      });
      setRemoteCursors((prev) => {
        if (!prev[m.id]) return prev;
        const next = { ...prev };
        delete next[m.id];
        return next;
      });
    });

    channel.bind(CLIENT_POINTER_EVENT, (data: CursorEvent) => {
      if (!data || data.userId === currentUserId) return;
      setRemoteCursors((prev) => {
        if (data.gone || typeof data.x !== "number" || typeof data.y !== "number") {
          if (!prev[data.userId]) return prev;
          const next = { ...prev };
          delete next[data.userId];
          return next;
        }
        const info = membersRef.current[data.userId];
        return {
          ...prev,
          [data.userId]: {
            userId: data.userId,
            name: info?.name ?? "Someone",
            color: info?.color ?? colorForUser(data.userId),
            x: data.x,
            y: data.y,
            ts: Date.now(),
          },
        };
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
      channelRef.current = null;
      membersRef.current = {};
    };
  }, [enabled, boardId, currentUserId]);

  // --- Reap stale cursors (a user who stopped moving without sending "gone") ---
  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => {
      const cutoff = Date.now() - CURSOR_STALE_MS;
      setRemoteCursors((prev) => {
        let changed = false;
        const next: typeof prev = {};
        for (const [id, c] of Object.entries(prev)) {
          if (c.ts >= cutoff) next[id] = c;
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, 2_000);
    return () => clearInterval(interval);
  }, [enabled]);

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

  const publishCursor = useCallback(
    (pos: { x: number; y: number } | null) => {
      if (!enabled || !currentUserId) return;
      const channel = channelRef.current;
      if (!channel) return;
      try {
        channel.trigger(
          CLIENT_POINTER_EVENT,
          pos
            ? { userId: currentUserId, x: pos.x, y: pos.y }
            : { userId: currentUserId, gone: true }
        );
      } catch {
        // Client events may be disabled on the Pusher app; ignore silently.
      }
    },
    [enabled, currentUserId]
  );

  const getSocketId = useCallback(() => socketIdRef.current, []);

  return {
    enabled,
    collaborators,
    remoteLocks,
    remoteCursors: Object.values(remoteCursors),
    acquireLocks,
    releaseLocks,
    publishCursor,
    getSocketId,
  };
}
