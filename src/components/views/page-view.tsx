"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLibrary } from "@/components/library/library-shell";
import type { SaveStatus } from "@/components/library/main-header";
import { PageEditor } from "@/components/editor/page-editor";
import {
  PageVersionHistoryButton,
  PageVersionHistoryModal,
} from "@/components/modals/page-version-history-modal";
import { useCollabSession } from "@/hooks/use-collab-session";
import { usePageCollaboration } from "@/hooks/use-page-collaboration";
import { isCollabClientConfigured } from "@/lib/collab/config";
import { colorForUser } from "@/lib/collab/user-colors";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { libraryHome, pageRoute } from "@/lib/routes";

type Page = {
  id: string;
  title: string;
  content: unknown;
  folderId: string | null;
  libraryId: string;
  updatedAt: string;
};

type Me = {
  id: string;
  email: string;
  name: string | null;
};

export function PageView() {
  const router = useRouter();
  const { pageId } = useParams<{ pageId: string }>();
  const { libraryId, refreshTree, setHeader, canEdit } = useLibrary();

  const [page, setPage] = useState<Page | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [syncKey, setSyncKey] = useState(0);
  const [syncedContent, setSyncedContent] = useState<unknown>(null);
  const [remoteNotice, setRemoteNotice] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editorEpoch, setEditorEpoch] = useState(0);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleFromRemoteRef = useRef(false);

  const collabEnabled = isCollabClientConfigured();

  const markSaved = useCallback(() => {
    setSaveStatus("saved");
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
  }, []);

  const showRemoteNotice = useCallback((message: string) => {
    setRemoteNotice(message);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setRemoteNotice(null), 3000);
  }, []);

  const handleRemoteTitle = useCallback(
    (title: string) => {
      titleFromRemoteRef.current = true;
      setTitleDraft(title);
      setPage((prev) => (prev ? { ...prev, title } : prev));
      showRemoteNotice(`Title updated`);
    },
    [showRemoteNotice]
  );

  const collabUser = useMemo(
    () =>
      me
        ? {
            id: me.id,
            name: me.name || me.email,
            color: colorForUser(me.id),
          }
        : null,
    [me]
  );

  const {
    session: collabSession,
    collaborators: collabCollaborators,
    error: collabError,
  } = useCollabSession({
    pageId,
    user: collabUser,
    enabled: collabEnabled && Boolean(page),
    onRemoteTitle: handleRemoteTitle,
  });

  const handleRemoteUpdate = useCallback(
    (payload: {
      title: string;
      content: unknown;
      updatedBy?: { name: string | null; email: string } | null;
    }) => {
      setTitleDraft(payload.title);
      setSyncedContent(payload.content);
      setSyncKey((k) => k + 1);
      setPage((prev) => (prev ? { ...prev, title: payload.title, content: payload.content } : prev));

      const by = payload.updatedBy?.name || payload.updatedBy?.email;
      if (by) showRemoteNotice(`Updated by ${by}`);
    },
    [showRemoteNotice]
  );

  const {
    collaborators: pollingCollaborators,
    markLocalEdit,
    noteSaved,
  } = usePageCollaboration({
    pageId,
    enabled: Boolean(page) && !collabEnabled,
    onRemoteUpdate: handleRemoteUpdate,
  });

  const collaborators = collabEnabled ? collabCollaborators : pollingCollaborators;

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiGet<Me>("/api/me");
        if (!cancelled) setMe(data);
      } catch {
        /* no-op */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPage(null);
    setTitleDraft("");
    setSaveStatus("idle");
    setRemoteNotice(null);
    (async () => {
      try {
        const data = await apiGet<Page>(`/api/pages/${pageId}`);
        if (cancelled) return;
        if (data.libraryId && data.libraryId !== libraryId) {
          router.replace(pageRoute(data.libraryId, data.id));
          return;
        }
        setPage(data);
        setTitleDraft(data.title);
        if (!collabEnabled) noteSaved(data.updatedAt);
      } catch {
        if (!cancelled) router.replace(libraryHome(libraryId));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pageId, libraryId, router, noteSaved, collabEnabled]);

  useEffect(() => {
    if (!page || page.id !== pageId) return;
    setHeader({
      saveStatus,
      titleOverride: titleDraft,
      folderIdFallback: page.folderId,
      collaborators,
      remoteNotice: collabError ?? remoteNotice,
    });
  }, [page, pageId, saveStatus, titleDraft, setHeader, collaborators, remoteNotice, collabError]);

  const savePage = useCallback(
    async (_content: unknown, _plainText: string) => {
      if (!page || !canEdit) return;
      setSaveStatus("saving");
      try {
        const updated = await apiPatch<Page>(`/api/pages/${page.id}`, {
          content: _content,
          title: titleDraft,
        });
        setPage(updated);
        if (!collabEnabled) noteSaved(updated.updatedAt);
        markSaved();
      } catch {
        setSaveStatus("error");
      }
    },
    [page, titleDraft, canEdit, markSaved, noteSaved, collabEnabled]
  );

  const handleRestore = useCallback(
    (restored: { id: string; title: string; content: unknown; updatedAt: string }) => {
      setPage((prev) => (prev ? { ...prev, ...restored } : prev));
      setTitleDraft(restored.title);
      setSyncedContent(restored.content);
      setSyncKey((k) => k + 1);
      setEditorEpoch((n) => n + 1);
      refreshTree();
      markSaved();
      showRemoteNotice("Version restored");
    },
    [refreshTree, markSaved, showRemoteNotice]
  );

  const saveTitle = useCallback(async () => {
    if (!page || !canEdit || titleDraft === page.title) return;
    if (titleFromRemoteRef.current) {
      titleFromRemoteRef.current = false;
      return;
    }

    if (!collabEnabled) markLocalEdit();
    setSaveStatus("saving");
    try {
      const updated = collabEnabled
        ? await apiPost<Page>(`/api/pages/${page.id}/yjs/title`, { title: titleDraft })
        : await apiPatch<Page>(`/api/pages/${page.id}`, { title: titleDraft });
      setPage(updated);
      if (!collabEnabled) noteSaved(updated.updatedAt);
      refreshTree();
      markSaved();
    } catch {
      setSaveStatus("error");
    }
  }, [
    page,
    titleDraft,
    canEdit,
    refreshTree,
    markSaved,
    markLocalEdit,
    noteSaved,
    collabEnabled,
  ]);

  if (!page) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  const collabReady =
    collabEnabled && collabSession && collabUser
      ? {
          ...collabSession,
          user: { name: collabUser.name, color: collabUser.color },
        }
      : undefined;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-8 py-12 md:px-16">
        <div className="mb-2 flex items-start justify-between gap-4">
          <input
            value={titleDraft}
            onChange={(e) => {
              if (!collabEnabled) markLocalEdit();
              titleFromRemoteRef.current = false;
              setTitleDraft(e.target.value);
            }}
            onBlur={saveTitle}
            readOnly={!canEdit}
            className="notion-page-title min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground read-only:cursor-default"
            placeholder="Untitled"
          />
          <PageVersionHistoryButton onClick={() => setHistoryOpen(true)} />
        </div>
        <PageVersionHistoryModal
          open={historyOpen}
          pageId={page.id}
          canEdit={canEdit}
          onOpenChange={setHistoryOpen}
          onRestore={handleRestore}
        />
        {collabEnabled && !collabReady ? (
          <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
            {collabError ? collabError : "Connecting to collaborators…"}
          </div>
        ) : (
          <PageEditor
            key={collabReady ? `${page.id}-collab-${editorEpoch}` : `${page.id}-${editorEpoch}`}
            pageId={page.id}
            content={page.content}
            onChange={savePage}
            onLocalEdit={collabEnabled ? undefined : markLocalEdit}
            syncedContent={syncedContent ?? page.content}
            syncKey={syncKey}
            readOnly={!canEdit}
            collab={collabReady}
          />
        )}
      </div>
    </div>
  );
}
