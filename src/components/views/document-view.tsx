"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLibrary } from "@/components/library/library-shell";
import { Badge } from "@/components/ui/badge";
import { documentRoute, libraryHome } from "@/lib/routes";
import { apiGet } from "@/lib/api";

type Document = {
  id: string;
  title: string;
  type: string;
  content: string;
  language: string | null;
  folderId: string | null;
  libraryId: string;
};

export function DocumentView() {
  const router = useRouter();
  const { documentId } = useParams<{ documentId: string }>();
  const { libraryId, setHeader } = useLibrary();

  const [document, setDocument] = useState<Document | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDocument(null);
    (async () => {
      try {
        const data = await apiGet<Document>(`/api/documents/${documentId}`);
        if (cancelled) return;
        if (data.libraryId && data.libraryId !== libraryId) {
          router.replace(documentRoute(data.libraryId, data.id));
          return;
        }
        setDocument(data);
      } catch {
        if (!cancelled) router.replace(libraryHome(libraryId));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId, libraryId, router]);

  useEffect(() => {
    if (!document || document.id !== documentId) return;
    setHeader({ folderIdFallback: document.folderId });
  }, [document, documentId, setHeader]);

  if (!document) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-8 py-12 md:px-16">
          <h1 className="notion-page-title mb-4">{document.title}</h1>
          <div className="mb-6 flex items-center gap-2">
            <Badge variant="secondary">{document.type}</Badge>
            {document.language && <Badge variant="outline">{document.language}</Badge>}
          </div>
          <pre className="whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-4 font-mono text-sm leading-relaxed">
            {document.content || "(No extracted text)"}
          </pre>
        </div>
      </div>
    </>
  );
}
