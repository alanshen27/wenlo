"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiDelete, apiGet, apiPost, getApiErrorMessage } from "@/lib/client/api";
import {
  recallChatQuery,
  type RecallChatSessionSummary,
} from "@/lib/recall-chat/recall-chat-shared";
import { recallChatRoute } from "@/lib/client/routes";

type RecallChatContextValue = {
  sessions: RecallChatSessionSummary[];
  activeSessionId: string | null;
  loadingSessions: boolean;
  sessionError: string | null;
  scope: "all" | "folder";
  setScope: (scope: "all" | "folder") => void;
  selectSession: (sessionId: string | null) => void;
  newChat: () => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  refreshSessions: () => Promise<void>;
  updateSessionMeta: (session: RecallChatSessionSummary) => void;
};

const RecallChatContext = createContext<RecallChatContextValue | null>(null);

export function useRecallChat() {
  const ctx = useContext(RecallChatContext);
  if (!ctx) throw new Error("useRecallChat must be used within RecallChatProvider");
  return ctx;
}

type ProviderProps = {
  libraryId: string;
  isRecallPage: boolean;
  contextFolderId: string | null;
  children: ReactNode;
};

export function RecallChatProvider({
  libraryId,
  isRecallPage,
  contextFolderId,
  children,
}: ProviderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [scope, setScope] = useState<"all" | "folder">("all");
  const [sessions, setSessions] = useState<RecallChatSessionSummary[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const sessionsLoadedFor = useRef<string | null>(null);

  const activeSessionId = searchParams.get("session");
  const effectiveFolderId = scope === "folder" ? contextFolderId : null;
  const historyQuery = recallChatQuery(scope, effectiveFolderId);
  const scopeKey = `${libraryId}:${scope}:${effectiveFolderId ?? "root"}`;

  const selectSession = useCallback(
    (sessionId: string | null) => {
      router.push(recallChatRoute(libraryId, sessionId));
    },
    [libraryId, router]
  );

  const loadSessions = useCallback(async () => {
    if (sessionsLoadedFor.current !== scopeKey) {
      setLoadingSessions(true);
    }
    setSessionError(null);
    try {
      const data = await apiGet<{ sessions: RecallChatSessionSummary[] }>(
        `/api/libraries/${libraryId}/recall-chat?${historyQuery}`
      );
      sessionsLoadedFor.current = scopeKey;
      setSessions(data.sessions);
      if (
        activeSessionId &&
        !data.sessions.some((session) => session.id === activeSessionId)
      ) {
        selectSession(null);
      }
    } catch (e) {
      setSessionError(getApiErrorMessage(e, "Failed to load chats"));
      setSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  }, [libraryId, historyQuery, scopeKey, activeSessionId, selectSession]);

  useEffect(() => {
    if (!isRecallPage) return;
    void loadSessions();
  }, [isRecallPage, loadSessions]);

  const newChat = useCallback(async () => {
    try {
      setSessionError(null);
      const data = await apiPost<{ session: RecallChatSessionSummary }>(
        `/api/libraries/${libraryId}/recall-chat?${historyQuery}`
      );
      setSessions((prev) => [data.session, ...prev]);
      selectSession(data.session.id);
    } catch (e) {
      setSessionError(getApiErrorMessage(e, "Failed to create chat"));
    }
  }, [libraryId, historyQuery, selectSession]);

  const deleteSession = useCallback(
    async (sessionId: string) => {
      try {
        await apiDelete(`/api/libraries/${libraryId}/recall-chat/${sessionId}`);
        setSessions((prev) => prev.filter((session) => session.id !== sessionId));
        if (activeSessionId === sessionId) selectSession(null);
      } catch (e) {
        setSessionError(getApiErrorMessage(e, "Failed to delete chat"));
      }
    },
    [libraryId, activeSessionId, selectSession]
  );

  const updateSessionMeta = useCallback(
    (session: RecallChatSessionSummary) => {
      setSessions((prev) => {
        const idx = prev.findIndex((item) => item.id === session.id);
        if (idx === -1) return [session, ...prev];
        const next = [...prev];
        next[idx] = { ...next[idx], ...session };
        return next.sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });
      selectSession(session.id);
    },
    [selectSession]
  );

  const value = useMemo(
    () => ({
      sessions,
      activeSessionId,
      loadingSessions,
      sessionError,
      scope,
      setScope,
      selectSession,
      newChat,
      deleteSession,
      refreshSessions: loadSessions,
      updateSessionMeta,
    }),
    [
      sessions,
      activeSessionId,
      loadingSessions,
      sessionError,
      scope,
      selectSession,
      newChat,
      deleteSession,
      loadSessions,
      updateSessionMeta,
    ]
  );

  return <RecallChatContext.Provider value={value}>{children}</RecallChatContext.Provider>;
}
