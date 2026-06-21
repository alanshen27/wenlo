"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { apiPost } from "@/lib/client/api";
import type { RecallResult } from "@/lib/core/types";
import { documentOpenRoute, pageRoute } from "@/lib/client/routes";
import Link from "next/link";

type Props = {
  libraryId: string;
  plainText: string;
};

/** Debounced inline suggestions while editing a page. */
export function ContextualRecallPanel({ libraryId, plainText }: Props) {
  const [results, setResults] = useState<RecallResult[]>([]);
  const [loading, setLoading] = useState(false);
  const lastQuery = useRef("");

  useEffect(() => {
    const paragraph = plainText.trim().slice(-400);
    if (paragraph.length < 60 || paragraph === lastQuery.current) return;

    const t = setTimeout(() => {
      lastQuery.current = paragraph;
      setLoading(true);
      void apiPost<{ results: RecallResult[] }>("/api/contextual-recall", {
        text: paragraph,
        libraryId,
        limit: 4,
      })
        .then((d) => setResults(d.results ?? []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 2000);

    return () => clearTimeout(t);
  }, [plainText, libraryId]);

  if (!results.length && !loading) return null;

  return (
    <aside className="hidden w-56 shrink-0 border-l border-border bg-muted/20 p-3 xl:block">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Sparkles className="size-3.5" />
        Related in library
      </div>
      {loading && !results.length ? (
        <p className="text-xs text-muted-foreground">Finding related content…</p>
      ) : (
        <ul className="space-y-2">
          {results.map((r) => (
            <li key={r.id}>
              <Link
                href={
                  r.sourceType === "page"
                    ? pageRoute(libraryId, r.id)
                    : documentOpenRoute(libraryId, r.id)
                }
                className="block rounded-md px-2 py-1.5 text-xs hover:bg-muted"
              >
                <p className="font-medium line-clamp-1">{r.title}</p>
                <p className="mt-0.5 line-clamp-2 text-muted-foreground">{r.snippet}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
