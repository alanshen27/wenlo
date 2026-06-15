"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { Download, Loader2 } from "lucide-react";
import { useLibrary } from "@/components/library/library-shell";
import type { SaveStatus } from "@/components/library/main-header";
import { Button } from "@/components/ui/button";
import { useBoardCollab } from "@/components/whiteboard/use-board-collab";
import type { BoardCanvasHandle } from "@/components/whiteboard/board-canvas";
import {
  applyBoardPatch,
  createEmptyBoard,
  normalizeBoard,
  type BoardDoc,
  type BoardPatch,
} from "@/lib/boards/board-schema";
import { isCollabClientConfigured } from "@/lib/collab/config";
import {
  apiGet,
  apiPatch,
  getApiErrorMessage,
  isCanceledError,
  isNotFoundError,
} from "@/lib/client/api";
import { ViewError } from "@/components/ui/view";
import { boardRoute, libraryHome } from "@/lib/client/routes";

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

type BoardData = {
  id: string;
  title: string;
  folderId: string | null;
  libraryId: string;
  scene: BoardDoc;
};

type Me = { id: string; email: string; name: string | null };

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
  const router = useRouter();
  const { boardId } = useParams<{ boardId: string }>();
  const { libraryId, canEdit, setHeader, refreshTree } = useLibrary();

  const [board, setBoard] = useState<BoardData | null>(null);
  const [scene, setScene] = useState<BoardDoc>(createEmptyBoard());
  const [title, setTitle] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [me, setMe] = useState<Me | null>(null);
  const [exporting, setExporting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const handleRef = useRef<BoardCanvasHandle | null>(null);
  const pendingRef = useRef<BoardPatch | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const collab = useBoardCollab({
    boardId,
    currentUserId: me?.id ?? null,
    enabled: isCollabClientConfigured() && Boolean(board),
    onRemotePatch: (patch) => setScene((prev) => applyBoardPatch(prev, patch)),
  });

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
    setBoard(null);
    setScene(createEmptyBoard());
    setSaveStatus("idle");
    setLoadError(null);
    void (async () => {
      try {
        const data = await apiGet<BoardData>(`/api/boards/${boardId}`);
        if (cancelled) return;
        if (data.libraryId && data.libraryId !== libraryId) {
          router.replace(boardRoute(data.libraryId, data.id));
          return;
        }
        setBoard(data);
        setScene(normalizeBoard(data.scene));
        setTitle(data.title);
      } catch (err) {
        if (cancelled || isCanceledError(err)) return;
        if (isNotFoundError(err)) {
          router.replace(libraryHome(libraryId));
          return;
        }
        setLoadError(getApiErrorMessage(err, "We couldn't load this whiteboard."));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [boardId, libraryId, router, reloadKey]);

  const flush = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const patch = pendingRef.current;
    pendingRef.current = null;
    if (!patch) return;
    setSaveStatus("saving");
    void apiPatch(`/api/boards/${boardId}`, { patch, socketId: collab.getSocketId() })
      .then(() => {
        setSaveStatus("saved");
        if (savedTimer.current) clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => setSaveStatus("idle"), 1500);
      })
      .catch(() => setSaveStatus("error"));
  }, [boardId, collab]);

  const handlePatch = useCallback(
    (patch: BoardPatch) => {
      setScene((prev) => applyBoardPatch(prev, patch));
      pendingRef.current = mergePatch(pendingRef.current, patch);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
    },
    [flush]
  );

  // Flush outstanding edits on unmount and before the tab closes.
  useEffect(() => {
    const onBeforeUnload = () => flush();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      flush();
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, [flush]);

  useEffect(() => {
    if (!board) return;
    setHeader({
      saveStatus,
      titleOverride: title,
      folderIdFallback: board.folderId,
      collaborators: collab.collaborators,
    });
  }, [board, saveStatus, title, collab.collaborators, setHeader]);

  const saveTitle = useCallback(async () => {
    if (!board || !canEdit || title === board.title) return;
    try {
      const updated = await apiPatch<{ title: string }>(`/api/documents/${board.id}`, { title });
      setBoard((prev) => (prev ? { ...prev, title: updated.title } : prev));
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
        onRetry={() => setReloadKey((k) => k + 1)}
      />
    );
  }

  if (!board) {
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
