"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useLibraryHeader, useLibraryScope, useLibraryTree } from "@/components/library/context";
import { useDocumentHeader } from "@/hooks/use-document-header";
import { PageEditor } from "@/components/editor/page-editor";
import { DocumentOutline } from "@/components/editor/document-outline";
import { EditorBodySkeleton, PageSkeleton } from "@/components/editor/editor-skeleton";
import { PageExportMenu } from "@/components/editor/page-export-menu";
import {
  PageVersionHistoryButton,
  PageVersionHistoryModal,
} from "@/components/modals/page-version-history-modal";
import type { RecallEditor } from "@/lib/editor/blocknote-schema";
import { useCollabSession } from "@/hooks/use-collab-session";
import { usePageCollaboration } from "@/hooks/use-page-collaboration";
import { useMe } from "@/hooks/use-me";
import { usePageDocument } from "@/hooks/use-native-documents";
import { useSaveStatus } from "@/hooks/use-save-status";
import { isCollabClientConfigured } from "@/lib/collab/config";
import { colorForUser } from "@/lib/collab/user-colors";
import { apiPatch, apiPost } from "@/lib/client/api";
import {
  extractDocumentHeadings,
  scrollToDocumentHeading,
  type DocumentHeading,
} from "@/lib/editor/editor-content";
import { ViewError, ViewScroll } from "@/components/ui/view";

type Page = {
  id: string;
  title: string;
  content: unknown;
  folderId: string | null;
  libraryId: string;
  updatedAt: string;
};

export function PageView() {
  const { pageId } = useParams<{ pageId: string }>();
  const { libraryId, canEdit } = useLibraryScope();
  const { refreshTree } = useLibraryTree();
  const { setHeader } = useLibraryHeader();
  const { data: me } = useMe();
  const { saveStatus, markSaving, markSaved, markError } = useSaveStatus(2000);
  const {
    data: page,
    isLoading,
    loadError,
    reload,
    setData: setPageData,
  } = usePageDocument(pageId, libraryId);

  const [titleDraft, setTitleDraft] = useState("");
  const [syncKey, setSyncKey] = useState(0);
  const [syncedContent, setSyncedContent] = useState<unknown>(null);
  const [remoteNotice, setRemoteNotice] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editorEpoch, setEditorEpoch] = useState(0);
  const [headings, setHeadings] = useState<DocumentHeading[]>([]);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleFromRemoteRef = useRef(false);
  const editorRef = useRef<RecallEditor | null>(null);

  const collabEnabled = isCollabClientConfigured();

  const showRemoteNotice = useCallback((message: string) => {
    setRemoteNotice(message);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setRemoteNotice(null), 3000);
  }, []);

  const handleRemoteTitle = useCallback(
    (title: string) => {
      titleFromRemoteRef.current = true;
      setTitleDraft(title);
      setPageData((prev) => (prev ? { ...prev, title } : prev));
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
      setPageData((prev) =>
        prev ? { ...prev, title: payload.title, content: payload.content } : prev
      );

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
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (page) setTitleDraft(page.title);
  }, [page?.id, page?.title]);

  useEffect(() => {
    if (page) setHeadings(extractDocumentHeadings(page.content));
  }, [page?.id, page?.content]);

  useEffect(() => {
    if (page && !collabEnabled) noteSaved(page.updatedAt);
  }, [page?.id, page?.updatedAt, collabEnabled, noteSaved]);

  const headerState = useMemo(() => {
    if (!page || page.id !== pageId) return undefined;
    return {
      saveStatus,
      titleOverride: titleDraft,
      folderIdFallback: page.folderId,
      collaborators,
      remoteNotice: collabError ?? remoteNotice,
    };
  }, [page, pageId, saveStatus, titleDraft, collaborators, remoteNotice, collabError]);

  useDocumentHeader(setHeader, headerState);

  const savePage = useCallback(
    async (_content: unknown, _plainText: string) => {
      if (!page || !canEdit) return;
      markSaving();
      try {
        const updated = await apiPatch<Page>(`/api/pages/${page.id}`, {
          content: _content,
          title: titleDraft,
        });
        setPageData(() => updated);
        if (!collabEnabled) noteSaved(updated.updatedAt);
        markSaved();
      } catch {
        markError();
      }
    },
    [page, titleDraft, canEdit, markSaved, markSaving, markError, noteSaved, collabEnabled]
  );

  const handleRestore = useCallback(
    (restored: { id: string; title: string; content: unknown; updatedAt: string }) => {
      setPageData((prev) => (prev ? { ...prev, ...restored } : prev));
      setTitleDraft(restored.title);
      setSyncedContent(restored.content);
      setSyncKey((k) => k + 1);
      setEditorEpoch((n) => n + 1);
      setHeadings(extractDocumentHeadings(restored.content));
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
    markSaving();
    try {
      const updated = collabEnabled
        ? await apiPost<Page>(`/api/pages/${page.id}/yjs/title`, { title: titleDraft })
        : await apiPatch<Page>(`/api/pages/${page.id}`, { title: titleDraft });
      setPageData(() => updated);
      if (!collabEnabled) noteSaved(updated.updatedAt);
      refreshTree();
      markSaved();
    } catch {
      markError();
    }
  }, [
    page,
    titleDraft,
    canEdit,
    refreshTree,
    markSaved,
    markSaving,
    markError,
    markLocalEdit,
    noteSaved,
    collabEnabled,
  ]);

  if (loadError) {
    return (
      <ViewScroll>
        <ViewError
          title="Couldn't load this page"
          message={loadError}
          onRetry={reload}
        />
      </ViewScroll>
    );
  }

  if (isLoading || !page) {
    return <PageSkeleton />;
  }

  const collabReady =
    collabEnabled && collabSession && collabUser
      ? {
          ...collabSession,
          user: { name: collabUser.name, color: collabUser.color },
        }
      : undefined;

  return (
    <div className="relative flex-1 overflow-x-hidden overflow-y-auto scrollbar-subtle">
      <div className="mx-auto w-full max-w-3xl px-8 py-12 md:px-16">
          <div className="mb-2 flex items-center justify-between gap-4">
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
            <div className="flex shrink-0 items-center gap-1">
              <PageExportMenu editorRef={editorRef} title={titleDraft} />
              <PageVersionHistoryButton onClick={() => setHistoryOpen(true)} />
            </div>
          </div>
          <PageVersionHistoryModal
            open={historyOpen}
            pageId={page.id}
            canEdit={canEdit}
            onOpenChange={setHistoryOpen}
            onRestore={handleRestore}
          />
          {collabEnabled && !collabReady ? (
            collabError ? (
              <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
                {collabError}
              </div>
            ) : (
              <EditorBodySkeleton />
            )
          ) : (
            <PageEditor
              key={collabReady ? `${page.id}-collab-${editorEpoch}` : `${page.id}-${editorEpoch}`}
              pageId={page.id}
              content={page.content}
              onChange={savePage}
              onLocalEdit={collabEnabled ? undefined : markLocalEdit}
              onEditorReady={(editor) => {
                editorRef.current = editor;
              }}
              onHeadingsChange={setHeadings}
              syncedContent={syncedContent ?? page.content}
              syncKey={syncKey}
              readOnly={!canEdit}
              collab={collabReady}
            />
          )}
      </div>
      <DocumentOutline headings={headings} onSelect={scrollToDocumentHeading} />
    </div>
  );
}
