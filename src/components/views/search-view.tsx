"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Sparkles } from "lucide-react";
import { useLibrary } from "@/components/library/library-shell";
import { ScopeSelect } from "@/components/search/scope-select";
import { SearchResultCard } from "@/components/search/search-result-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RecallResult } from "@/lib/core/types";
import { documentRoute, pageRoute, recallRoute } from "@/lib/client/routes";
import { apiPost, getApiErrorMessage } from "@/lib/client/api";

export function SearchView() {
  const router = useRouter();
  const { libraryId, activeLibrary, folders, contextFolderId } = useLibrary();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"all" | "folder">("all");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<RecallResult[]>([]);
  const [searchedQuery, setSearchedQuery] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const folderName = contextFolderId
    ? folders.find((f) => f.id === contextFolderId)?.name
    : null;
  const folderColor = contextFolderId
    ? folders.find((f) => f.id === contextFolderId)?.color
    : null;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const runSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);
    setSearchedQuery(trimmed);

    try {
      const data = await apiPost<{ results: RecallResult[] }>("/api/recall", {
        query: trimmed,
        libraryId,
        folderId: scope === "folder" ? contextFolderId : null,
      });
      setResults(data.results);
    } catch (e) {
      setError(getApiErrorMessage(e, "Search failed"));
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, loading, libraryId, scope, contextFolderId]);

  function openResult(result: RecallResult) {
    if (result.sourceType === "page") router.push(pageRoute(libraryId, result.id));
    else router.push(documentRoute(libraryId, result.id));
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-border px-6 py-8 md:px-10">
        <div className="mx-auto max-w-2xl">
          <h1 className="mb-1 text-2xl font-semibold tracking-tight">Search</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Full-text and semantic search across pages and files in this library.
          </p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              runSearch();
            }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search notes, PDFs, code…"
                className="h-10 pl-9"
              />
            </div>
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
            <Button type="submit" disabled={loading || !query.trim()}>
              {loading ? "Searching…" : "Search"}
            </Button>
          </form>
          {scope === "folder" && !contextFolderId && (
            <p className="mt-2 text-xs text-muted-foreground">
              Select a folder from the sidebar to limit search scope, or switch to entire library.
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 md:px-10">
        <div className="mx-auto max-w-2xl space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}

          {searchedQuery && !loading && !error && (
            <p className="text-sm text-muted-foreground">
              {results.length} result{results.length !== 1 ? "s" : ""} for &ldquo;{searchedQuery}&rdquo;
            </p>
          )}

          {results.map((result) => (
            <SearchResultCard key={`${result.sourceType}-${result.id}`} result={result} onOpen={openResult} />
          ))}

          {searchedQuery && !loading && results.length === 0 && !error && (
            <p className="text-sm text-muted-foreground">No matches found.</p>
          )}

          {!searchedQuery && !loading && (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <p className="mb-3 text-sm text-muted-foreground">
                Try keywords from a lecture, a function name, or a concept you remember.
              </p>
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href={recallRoute(libraryId)} className="gap-2" />}
              >
                <Sparkles className="size-3.5" />
                Need a synthesized answer? Try Recall
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
