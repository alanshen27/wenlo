"use client";

import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import type { PageCollaborator } from "@/lib/realtime/page-presence";
import { PusherYjsProvider, type CollabUser } from "@/lib/collab/pusher-yjs-provider";

export type CollabSession = {
  doc: Y.Doc;
  provider: PusherYjsProvider;
};

type Options = {
  pageId: string;
  user: CollabUser | null;
  enabled?: boolean;
  onRemoteTitle?: (title: string) => void;
};

export function useCollabSession({
  pageId,
  user,
  enabled = true,
  onRemoteTitle,
}: Options) {
  const [session, setSession] = useState<CollabSession | null>(null);
  const [collaborators, setCollaborators] = useState<PageCollaborator[]>([]);
  const [error, setError] = useState<string | null>(null);
  const onRemoteTitleRef = useRef(onRemoteTitle);
  const userRef = useRef(user);
  onRemoteTitleRef.current = onRemoteTitle;
  userRef.current = user;

  const userId = user?.id ?? null;

  useEffect(() => {
    if (!enabled || !userId) {
      setSession(null);
      setCollaborators([]);
      return;
    }

    const doc = new Y.Doc();
    const collabUser = userRef.current!;
    const provider = new PusherYjsProvider(doc, pageId, collabUser);
    provider.onCollaboratorsChange = setCollaborators;
    provider.onTitle = (title) => onRemoteTitleRef.current?.(title);

    setSession({ doc, provider });
    setError(null);

    return () => {
      provider.destroy();
      doc.destroy();
      setSession(null);
      setCollaborators([]);
    };
  }, [pageId, userId, enabled]);

  return { session, collaborators, error };
}
