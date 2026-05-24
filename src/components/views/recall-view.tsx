"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Sparkles } from "lucide-react";
import { useLibrary } from "@/components/library/library-shell";
import { ScopeSelect } from "@/components/search/scope-select";
import { SearchResultCard } from "@/components/search/search-result-card";
import { Button, buttonVariants } from "@/components/ui/button";
import type { RecallResult } from "@/lib/types";
import { notifyUsageUpdated } from "@/lib/usage-events";
import { documentRoute, pageRoute, searchRoute } from "@/lib/routes";
import { cn } from "@/lib/utils";

type Turn = {
  question: string;
  answer: string;
  sources: RecallResult[];
};

export function RecallView() {
  const router = useRouter();
  const { libraryId, activeLibrary, folders, contextFolderId } = useLibrary();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [question, setQuestion] = useState("");
  const [scope, setScope] = useState<"all" | "folder">("all");
  const [loading, setLoading] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);

  const folderName = contextFolderId
    ? folders.find((f) => f.id === contextFolderId)?.name
    : null;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const ask = useCallback(async () => {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);
    setQuestion("");

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          libraryId,
          folderId: scope === "folder" ? contextFolderId : null,
          scope,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Recall failed");

      setTurns((prev) => [
        ...prev,
        {
          question: trimmed,
          answer: data.answer as string,
          sources: data.sources as RecallResult[],
        },
      ]);
      notifyUsageUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recall failed");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [question, loading, libraryId, contextFolderId, scope]);

  function openResult(result: RecallResult) {
    if (result.sourceType === "page") router.push(pageRoute(libraryId, result.id));
    else router.push(documentRoute(libraryId, result.id));
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="relative border-b border-border px-6 py-8 md:px-10">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-amber-500/5" />
        <div className="relative mx-auto max-w-2xl">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <Sparkles className="size-4" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Recall</h1>
          </div>
          <p className="mb-6 max-w-lg text-sm text-muted-foreground">
            Ask a question and get a synthesized answer drawn from across your library — pages,
            PDFs, slides, and code. Recall reads up to a dozen relevant sources before responding.
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ScopeSelect
              scope={scope}
              onScopeChange={setScope}
              libraryName={activeLibrary?.name}
              folderName={folderName}
              folderId={contextFolderId}
              size="sm"
            />
            <Link
              href={searchRoute(libraryId)}
              className={buttonVariants({ variant: "ghost", size: "sm", className: "h-8 gap-1.5 text-xs" })}
            >
              <Search className="size-3.5" />
              Raw search
            </Link>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 md:px-10">
        <div className="mx-auto max-w-2xl space-y-8">
          {turns.length === 0 && !loading && (
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-6">
              <p className="mb-2 text-sm font-medium">Example questions</p>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li>&ldquo;Summarize what I have on dynamic programming&rdquo;</li>
                <li>&ldquo;How does my notes explain backpropagation?&rdquo;</li>
                <li>&ldquo;Compare the two approaches I wrote about graph traversal&rdquo;</li>
              </ul>
            </div>
          )}

          {turns.map((turn, i) => (
            <div key={i} className="space-y-4">
              <div className="rounded-lg bg-muted/50 px-4 py-3">
                <p className="text-sm font-medium text-foreground">{turn.question}</p>
              </div>
              <div className="space-y-3">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {turn.answer}
                </p>
                {turn.sources.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Context from {turn.sources.length} source
                      {turn.sources.length !== 1 ? "s" : ""}
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

          {loading && (
            <p className="animate-pulse text-sm text-muted-foreground">
              Reading your library and composing an answer…
            </p>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </div>

      <form
        className="border-t border-border px-6 py-4 md:px-10"
        onSubmit={(e) => {
          e.preventDefault();
          ask();
        }}
      >
        <div className="mx-auto flex max-w-2xl gap-2">
          <textarea
            ref={inputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask anything about your notes…"
            rows={2}
            className={cn(
              "min-h-[52px] w-full flex-1 resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
              loading && "opacity-60"
            )}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask();
              }
            }}
          />
          <Button type="submit" disabled={loading || !question.trim()} className="shrink-0 self-end">
            Recall
          </Button>
        </div>
      </form>
    </div>
  );
}
