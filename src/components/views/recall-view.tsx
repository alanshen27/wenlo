"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Search, Sparkles } from "lucide-react";
import { useLibrary } from "@/components/library/library-shell";
import { useRecallChat } from "@/components/recall/recall-chat-context";
import { ScopeSelect } from "@/components/search/scope-select";
import { SearchResultCard } from "@/components/search/search-result-card";
import { Button } from "@/components/ui/button";
import type { RecallResult } from "@/lib/core/types";
import { notifyUsageUpdated } from "@/lib/billing/usage-events";
import { documentRoute, pageRoute, searchRoute } from "@/lib/client/routes";
import { apiGet, getApiErrorMessage } from "@/lib/client/api";
import type { RecallChatSessionSummary, RecallTurn } from "@/lib/recall-chat/recall-chat-shared";
import { cn } from "@/lib/core/utils";
import MarkdownRenderer from "../recall/markdown-renderer";

type AgentStreamEvent =
  | { type: "meta"; sessionId: string; sources: RecallResult[]; scope: "all" | "folder" }
  | { type: "delta"; text: string }
  | {
      type: "done";
      sessionId: string;
      session: { id: string; title: string | null; turnCount: number };
      turn: RecallTurn;
    }
  | { type: "error"; error: string };

const EXAMPLE_PROMPTS = [
  "Summarize what I have on dynamic programming",
  "How does my notes explain backpropagation?",
  "Compare the two approaches I wrote about graph traversal",
];

export function RecallView() {
  const router = useRouter();
  const { libraryId, activeLibrary, folders, contextFolderId } = useLibrary();
  const {
    activeSessionId,
    scope,
    setScope,
    updateSessionMeta,
    refreshSessions,
  } = useRecallChat();

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [turns, setTurns] = useState<RecallTurn[]>([]);
  const [streamingTurn, setStreamingTurn] = useState<RecallTurn | null>(null);
  const [error, setError] = useState<string | null>(null);

  const folderName = contextFolderId
    ? folders.find((f) => f.id === contextFolderId)?.name
    : null;
  const folderColor = contextFolderId
    ? folders.find((f) => f.id === contextFolderId)?.color
    : null;
  const effectiveFolderId = scope === "folder" ? contextFolderId : null;

  useEffect(() => {
    inputRef.current?.focus();
  }, [activeSessionId]);

  useEffect(() => {
    if (!activeSessionId) return;

    let cancelled = false;
    setLoadingHistory(true);
    setError(null);

    apiGet<{ session: RecallChatSessionSummary; turns: RecallTurn[] }>(
      `/api/libraries/${libraryId}/recall-chat/${activeSessionId}`
    )
      .then((data) => {
        if (cancelled) return;
        setTurns(data.turns);
      })
      .catch((e) => {
        if (!cancelled) setError(getApiErrorMessage(e, "Failed to load chat"));
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });

    return () => {
      cancelled = true;
    };
  }, [libraryId, activeSessionId]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, loading, streamingTurn?.answer]);

  const ask = useCallback(async () => {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);
    setQuestion("");
    setStreamingTurn({
      question: trimmed,
      answer: "",
      sources: [],
      createdAt: new Date().toISOString(),
    });

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          question: trimmed,
          libraryId,
          folderId: effectiveFolderId,
          scope,
          sessionId: activeSessionId,
        }),
      });

      if (!res.ok || !res.body) {
        let message = "Recall failed";
        try {
          const data = await res.json();
          if (typeof data?.error === "string") message = data.error;
        } catch {}
        throw new Error(message);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamError: string | null = null;

      const handleEvent = (event: AgentStreamEvent) => {
        if (event.type === "meta") {
          setStreamingTurn((prev) =>
            prev ? { ...prev, sources: event.sources } : prev
          );
        } else if (event.type === "delta") {
          setStreamingTurn((prev) =>
            prev ? { ...prev, answer: prev.answer + event.text } : prev
          );
        } else if (event.type === "done") {
          setTurns((prev) => [...prev, event.turn]);
          setStreamingTurn(null);
          updateSessionMeta({
            id: event.session.id,
            title: event.session.title,
            turnCount: event.session.turnCount,
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          });
          refreshSessions();
          notifyUsageUpdated();
        } else if (event.type === "error") {
          streamError = event.error;
        }
      };

      const drain = (chunk: string) => {
        buffer += chunk;
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          if (!line) continue;
          try {
            handleEvent(JSON.parse(line) as AgentStreamEvent);
          } catch {}
        }
      };

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        drain(decoder.decode(value, { stream: true }));
      }
      drain(decoder.decode());

      if (streamError) throw new Error(streamError);
    } catch (e) {
      setError(getApiErrorMessage(e, "Recall failed"));
      setQuestion(trimmed);
      setStreamingTurn(null);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [
    question,
    loading,
    libraryId,
    effectiveFolderId,
    scope,
    activeSessionId,
    updateSessionMeta,
    refreshSessions,
  ]);

  function openResult(result: RecallResult) {
    if (result.sourceType === "page") router.push(pageRoute(libraryId, result.id));
    else router.push(documentRoute(libraryId, result.id));
  }

  const displayTurns = activeSessionId ? turns : [];
  const showWelcome = !loadingHistory && displayTurns.length === 0 && !loading;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
        <ScopeSelect
          scope={scope}
          onScopeChange={setScope}
          libraryName={activeLibrary?.name}
          libraryIcon={activeLibrary?.icon}
          folderName={folderName}
          folderColor={folderColor}
          folderId={contextFolderId}
          size="sm"
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs text-muted-foreground"
          render={<Link href={searchRoute(libraryId)} />}
        >
          <Search className="size-3.5" />
          Raw search
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
        <div className="mx-auto max-w-2xl space-y-6">
          {activeSessionId && loadingHistory && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading chat…
            </div>
          )}

          {showWelcome && (
            <div className="flex flex-col items-center py-10 text-center md:py-16">
              <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="size-6" />
              </div>
              <h2 className="mb-2 text-lg font-semibold tracking-tight">
                {activeSessionId ? "What do you want to recall?" : "Ask anything about your notes"}
              </h2>
              <p className="mb-6 max-w-sm text-sm text-muted-foreground">
                Recall searches your pages and files, then synthesizes an answer with sources.
              </p>
              <div className="flex w-full max-w-md flex-col gap-2">
                {EXAMPLE_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    disabled={loadingHistory}
                    onClick={() => {
                      setQuestion(prompt);
                      inputRef.current?.focus();
                    }}
                    className="rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-foreground"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {displayTurns.map((turn, i) => (
            <div key={`${turn.createdAt}-${i}`} className="space-y-4">
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                  {turn.question}
                </div>
              </div>
              <div className="space-y-3">
                <div className="max-w-[95%] rounded-2xl rounded-bl-sm bg-muted/60 px-4 py-3">
                  <MarkdownRenderer content={turn.answer} />
                </div>
                {turn.sources.length > 0 && (
                  <div className="space-y-2 pl-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      {turn.sources.length} source{turn.sources.length !== 1 ? "s" : ""}
                    </p>
                    <div className="space-y-2">
                      {turn.sources.map((source) => (
                        <SearchResultCard
                          key={`${source.sourceType}-${source.id}-${i}`}
                          result={source}
                          onOpen={openResult}
                          compact
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {streamingTurn && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                  {streamingTurn.question}
                </div>
              </div>
              <div className="max-w-[95%] rounded-2xl rounded-bl-sm bg-muted/60 px-4 py-3">
                {streamingTurn.answer ? (
                  <MarkdownRenderer content={streamingTurn.answer} />
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Reading your library…
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div ref={logEndRef} />
        </div>
      </div>

      <div className="shrink-0 border-t border-border px-4 py-4 md:px-8">
        <form
          className="mx-auto max-w-2xl"
          onSubmit={(e) => {
            e.preventDefault();
            ask();
          }}
        >
          <div className="rounded-2xl border border-border bg-card shadow-sm transition-shadow focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
            <textarea
              ref={inputRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask anything about your notes…"
              rows={2}
              disabled={loadingHistory}
              className={cn(
                "min-h-[56px] w-full resize-none rounded-2xl border-0 bg-transparent px-4 pt-3 pb-2 text-sm outline-none placeholder:text-muted-foreground",
                (loading || loadingHistory) && "opacity-60"
              )}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask();
                }
              }}
            />
            <div className="flex items-center justify-between gap-2 px-3 pb-3">
              <span className="text-[11px] text-muted-foreground">
                Enter to send · Shift+Enter for newline
              </span>
              <Button
                type="submit"
                size="sm"
                disabled={loadingHistory || loading || !question.trim()}
                className="gap-1.5"
              >
                <Sparkles className="size-3.5" />
                Recall
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
