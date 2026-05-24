"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PageCollaborator } from "@/lib/page-presence";
import { apiDelete, apiGet, apiPost } from "@/lib/api";

type SyncPayload = {
  title: string;
  content: unknown;
  updatedAt: string;
  updatedBy?: PageCollaborator | null;
};

type Options = {
  pageId: string;
  enabled?: boolean;
  onRemoteUpdate: (payload: SyncPayload) => void;
};

export function usePageCollaboration({ pageId, enabled = true, onRemoteUpdate }: Options) {
  const [collaborators, setCollaborators] = useState<PageCollaborator[]>([]);
  const lastUpdatedAtRef = useRef<string | null>(null);
  const lastLocalEditRef = useRef(0);
  const onRemoteUpdateRef = useRef(onRemoteUpdate);
  onRemoteUpdateRef.current = onRemoteUpdate;

  const markLocalEdit = useCallback(() => {
    lastLocalEditRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (!enabled || !pageId) return;

    let cancelled = false;

    async function heartbeat() {
      if (cancelled) return;
      try {
        const data = await apiPost<{ collaborators?: PageCollaborator[] }>(
          `/api/pages/${pageId}/presence`
        );
        if (cancelled) return;
        setCollaborators(data.collaborators ?? []);
      } catch {
        /* noop */
      }
    }

    async function pollPage() {
      try {
        if (cancelled) return;
        const page = await apiGet<{ title: string; content: unknown; updatedAt: string }>(
          `/api/pages/${pageId}`
        );
        if (cancelled) return;
        const updatedAt = page.updatedAt as string;

        if (!lastUpdatedAtRef.current) {
          lastUpdatedAtRef.current = updatedAt;
          return;
        }

        if (updatedAt <= lastUpdatedAtRef.current) return;

        const editingRecently = Date.now() - lastLocalEditRef.current < 2500;
        if (editingRecently) return;

        lastUpdatedAtRef.current = updatedAt;

        let presenceData: { collaborators?: PageCollaborator[] };
        try {
          presenceData = await apiGet<{ collaborators?: PageCollaborator[] }>(
            `/api/pages/${pageId}/presence`
          );
        } catch {
          presenceData = { collaborators: [] };
        }

        const editors = (presenceData.collaborators ?? []) as PageCollaborator[];

        onRemoteUpdateRef.current({
          title: page.title,
          content: page.content,
          updatedAt,
          updatedBy: editors[0] ?? null,
        });
      } catch {
        /* noop — same as !res.ok for page fetch */
      }
    }

    void heartbeat();
    const heartbeatId = window.setInterval(() => void heartbeat(), 10_000);
    const pollId = window.setInterval(() => void pollPage(), 3_000);

    return () => {
      cancelled = true;
      window.clearInterval(heartbeatId);
      window.clearInterval(pollId);
      void apiDelete(`/api/pages/${pageId}/presence`).catch(() => {
        /* ignore */
      });
    };
  }, [pageId, enabled]);

  const noteSaved = useCallback((updatedAt: string) => {
    lastUpdatedAtRef.current = updatedAt;
  }, []);

  return { collaborators, markLocalEdit, noteSaved };
}
