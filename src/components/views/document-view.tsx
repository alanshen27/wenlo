"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { useLibrary } from "@/components/library/library-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ViewContainer, ViewScroll } from "@/components/ui/view";
import { documentRoute, libraryHome } from "@/lib/client/routes";
import { apiGet } from "@/lib/client/api";
import { FileArtwork, getDocumentLabel } from "@/lib/client/file-icons";
import { cn, formatBytes } from "@/lib/core/utils";

type Document = {
  id: string;
  title: string;
  type: string;
  content: string;
  language: string | null;
  folderId: string | null;
  libraryId: string;
  mimeType: string | null;
  storagePath: string | null;
  sizeBytes: number | null;
};

export function DocumentView() {
  const router = useRouter();
  const { documentId } = useParams<{ documentId: string }>();
  const { libraryId, setHeader } = useLibrary();

  const [document, setDocument] = useState<Document | null>(null);
  const [mediaError, setMediaError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDocument(null);
    setMediaError(false);
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

  const isCode = document.type === "CODE";
  const text = document.content?.trim() ?? "";
  const paragraphs = text ? text.split(/\n{2,}/) : [];

  const rawUrl = `/api/documents/${document.id}/raw`;
  const mime = document.mimeType ?? "";
  const hasFile = Boolean(document.storagePath) && !mediaError;
  const isImage = hasFile && (document.type === "IMAGE" || mime.startsWith("image/"));
  const isVideo = hasFile && (document.type === "VIDEO" || mime.startsWith("video/"));
  const isAudio = hasFile && (document.type === "AUDIO" || mime.startsWith("audio/"));
  const isPdf = hasFile && mime === "application/pdf";
  const hasInlineMedia = isImage || isVideo || isAudio || isPdf;

  return (
    <ViewScroll>
      <ViewContainer size="prose">
        <div className="mb-6 flex items-start gap-3">
          <FileArtwork type={document.type} className="mt-0.5 size-9 shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold leading-tight tracking-tight wrap-break-word">
              {document.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{getDocumentLabel(document.type)}</Badge>
              {document.language && (
                <Badge variant="outline">{document.language}</Badge>
              )}
              {formatBytes(document.sizeBytes) && (
                <Badge variant="outline">{formatBytes(document.sizeBytes)}</Badge>
              )}
            </div>
          </div>
          {document.storagePath && (
            <a
              href={`${rawUrl}?download=1`}
              download={document.title}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
            >
              <Download className="size-4" />
              <span className="hidden sm:inline">Download</span>
            </a>
          )}
        </div>

        {hasInlineMedia && (
          <div className="mb-6 overflow-hidden rounded-xl border border-border bg-muted/30">
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={rawUrl}
                alt={document.title}
                className="mx-auto max-h-[70vh] w-full object-contain"
                onError={() => setMediaError(true)}
              />
            ) : isVideo ? (
              <video
                src={rawUrl}
                controls
                className="max-h-[70vh] w-full"
                onError={() => setMediaError(true)}
              />
            ) : isPdf ? (
              <iframe src={rawUrl} title={document.title} className="h-[80vh] w-full" />
            ) : (
              <div className="flex flex-col items-center gap-4 p-6">
                <FileArtwork type="AUDIO" className="size-16" />
                <audio
                  src={rawUrl}
                  controls
                  className="w-full"
                  onError={() => setMediaError(true)}
                />
              </div>
            )}
          </div>
        )}

        {!text ? (
          hasInlineMedia ? null : (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center text-sm text-muted-foreground">
              No extracted text for this file.
            </div>
          )
        ) : isCode ? (
          <pre className="overflow-x-auto rounded-xl border border-border bg-muted/40 p-4 font-mono text-[0.8rem] leading-relaxed">
            <code>{text}</code>
          </pre>
        ) : (
          <article className="space-y-4 text-[0.95rem] leading-7 text-foreground/90">
            {paragraphs.map((para, i) => (
              <p key={i} className="whitespace-pre-line wrap-break-word">
                {para}
              </p>
            ))}
          </article>
        )}
      </ViewContainer>
    </ViewScroll>
  );
}
