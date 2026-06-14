"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLibrary } from "@/components/library/library-shell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ViewContainer, ViewScroll } from "@/components/ui/view";
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
      <ViewScroll>
        <ViewContainer size="prose">
          <Skeleton className="mb-4 h-9 w-2/3" />
          <div className="mb-6 flex items-center gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <div className="space-y-2.5 rounded-lg border border-border bg-muted/40 p-4">
            {["95%", "88%", "70%", "92%", "60%", "80%", "45%"].map((w, i) => (
              <Skeleton key={i} className="h-3.5" style={{ width: w }} />
            ))}
          </div>
        </ViewContainer>
      </ViewScroll>
    );
  }

  return (
    <ViewScroll>
      <ViewContainer size="prose">
        <h1 className="notion-page-title mb-4">{document.title}</h1>
        <div className="mb-6 flex items-center gap-2">
          <Badge variant="secondary">{document.type}</Badge>
          {document.language && <Badge variant="outline">{document.language}</Badge>}
        </div>
        <pre className="whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-4 font-mono text-sm leading-relaxed">
          {document.content || "(No extracted text)"}
        </pre>
      </ViewContainer>
    </ViewScroll>
  );
}
