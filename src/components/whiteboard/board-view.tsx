"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { Download, Loader2 } from "lucide-react";
import { useLibraryHeader, useLibraryScope, useLibraryTree } from "@/components/library/context";
import { useDocumentHeader } from "@/hooks/use-document-header";
import { useBoardCollab } from "@/components/whiteboard/use-board-collab";
import { useDebouncedFlush } from "@/hooks/use-debounced-persist";
import { useBoardDocument } from "@/hooks/use-native-documents";
import { useMe } from "@/hooks/use-me";
import { useSaveStatus } from "@/hooks/use-save-status";
import { Button } from "@/components/ui/button";
import type { BoardCanvasHandle } from "@/components/whiteboard/board-canvas";
import {
  applyBoardPatch,
  createEmptyBoard,
  normalizeBoard,
  type BoardDoc,
  type BoardPatch,
} from "@/lib/boards/board-schema";
import { isCollabClientConfigured } from "@/lib/collab/config";
import { apiPatch } from "@/lib/client/api";
import { ViewError } from "@/components/ui/view";

const BoardCanvas = dynamic(
  () => import("@/components/whiteboard/board-canvas").then((m) => m.BoardCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-muted/20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

const SAVE_DEBOUNCE_MS = 600;

/** Coalesces a new patch into the pending one so a single flush captures all edits. */
function mergePatch(base: BoardPatch | null, next: BoardPatch): BoardPatch {
  const merged: BoardPatch = {
    upserts: { ...(base?.upserts ?? {}) },
    deletes: [...(base?.deletes ?? [])],
  };
  if (next.upserts) {
    for (const [id, el] of Object.entries(next.upserts)) {
      merged.upserts![id] = el;
      merged.deletes = merged.deletes!.filter((d) => d !== id);
    }
  }
  if (next.deletes) {
    for (const id of next.deletes) {
      delete merged.upserts![id];
      if (!merged.deletes!.includes(id)) merged.deletes!.push(id);
    }
  }
  if (next.elementOrder) merged.elementOrder = next.elementOrder;
  else if (base?.elementOrder) merged.elementOrder = base.elementOrder;
  if (Object.keys(merged.upserts!).length === 0) delete merged.upserts;
  if (merged.deletes!.length === 0) delete merged.deletes;
  return merged;
}

export function BoardView() {
  const { boardId } = useParams<{ boardId: string }>();
  const { libraryId, canEdit } = useLibraryScope();
  const { refreshTree } = useLibraryTree();
  const { setHeader } = useLibraryHeader();
  const { data: me } = useMe();
  const { saveStatus, markSaving, markSaved, markError } = useSaveStatus();
  const { data: board, isLoading, loadError, reload } = useBoardDocument(boardId, libraryId);

  const [scene, setScene] = useState<BoardDoc>(createEmptyBoard());
  const [title, setTitle] = useState("");
  const [exporting, setExporting] = useState(false);

  const handleRef = useRef<BoardCanvasHandle | null>(null);
  const pendingRef = useRef<BoardPatch | null>(null);

  const collab = useBoardCollab({
    boardId,
    currentUserId: me?.id ?? null,
    enabled: isCollabClientConfigured() && Boolean(board),
    onRemotePatch: (patch) => setScene((prev) => applyBoardPatch(prev, patch)),
  });

  useEffect(() => {
    if (!board) return;
    setScene(normalizeBoard(board.scene as BoardDoc));
    setTitle(board.title);
  }, [board?.id]);

  const flush = useCallback(() => {
    const patch = pendingRef.current;
    pendingRef.current = null;
    if (!patch) return;
    markSaving();
    void apiPatch(`/api/boards/${boardId}`, { patch, socketId: collab.getSocketId() })
      .then(() => markSaved())
      .catch(() => markError());
  }, [boardId, collab, markSaving, markSaved, markError]);

  const { schedule } = useDebouncedFlush(flush, SAVE_DEBOUNCE_MS);

  const handlePatch = useCallback(
    (patch: BoardPatch) => {
      setScene((prev) => applyBoardPatch(prev, patch));
      pendingRef.current = mergePatch(pendingRef.current, patch);
      schedule();
    },
    [schedule]
  );

  const headerState = useMemo(() => {
    if (!board) return undefined;
    return {
      saveStatus,
      titleOverride: title,
      folderIdFallback: board.folderId,
      collaborators: collab.collaborators,
    };
  }, [board, saveStatus, title, collab.collaborators]);

  useDocumentHeader(setHeader, headerState);

  const saveTitle = useCallback(async () => {
    if (!board || !canEdit || title === board.title) return;
    try {
      const updated = await apiPatch<{ title: string }>(`/api/documents/${board.id}`, { title });
      setTitle(updated.title);
      refreshTree();
    } catch {
      /* keep local title */
    }
  }, [board, canEdit, title, refreshTree]);

  const handleExport = useCallback(() => {
    const url = handleRef.current?.exportPng();
    if (!url) return;
    setExporting(true);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title || "whiteboard"}.png`;
    link.click();
    setTimeout(() => setExporting(false), 400);
  }, [title]);

  const readOnly = !canEdit;

  const registerHandle = useCallback((handle: BoardCanvasHandle | null) => {
    handleRef.current = handle;
  }, []);

  const canvas = useMemo(() => {
    if (!board) return null;
    return (
      <BoardCanvas
        scene={scene}
        readOnly={readOnly}
        libraryId={board.libraryId}
        folderId={board.folderId}
        remoteLocks={collab.remoteLocks}
        remoteCursors={collab.remoteCursors}
        onPatch={handlePatch}
        requestLock={collab.acquireLocks}
        releaseLock={collab.releaseLocks}
        publishCursor={collab.publishCursor}
        registerHandle={registerHandle}
      />
    );
  }, [board, scene, readOnly, collab.remoteLocks, collab.remoteCursors, collab.acquireLocks, collab.releaseLocks, collab.publishCursor, handlePatch, registerHandle]);

  if (loadError) {
    return (
      <ViewError
        title="Couldn't load this whiteboard"
        message={loadError}
        onRetry={reload}
      />
    );
  }

  if (isLoading || !board) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          readOnly={readOnly}
          placeholder="Untitled whiteboard"
          className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none read-only:cursor-default"
        />
        {readOnly && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            Read-only
          </span>
        )}
        <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
          {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Export PNG
        </Button>
      </div>
      <div className="relative flex-1">{canvas}</div>
    </div>
  );
}
