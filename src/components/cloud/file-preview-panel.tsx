"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, ExternalLink, FileText, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileArtwork, getDocumentLabel } from "@/lib/client/file-icons";
import { apiGet } from "@/lib/client/api";
import {
  boardRoute,
  databaseRoute,
  deckRoute,
  documentRoute,
  flowchartRoute,
  pdfRoute,
} from "@/lib/client/routes";
import { cn, formatBytes } from "@/lib/core/utils";
import { BoardPreview } from "@/components/whiteboard/board-preview";
import type { BoardDoc } from "@/lib/boards/board-schema";
import { DeckSlideSvg } from "@/components/slideshow/deck-slide-svg";
import { PdfPagePreview } from "@/components/pdf/pdf-page-preview";
import type { DeckDoc } from "@/lib/decks/deck-schema";

export type PreviewTarget = { id: string; title: string; type: string };

type DocumentDetail = {
  id: string;
  title: string;
  type: string;
  mimeType: string | null;
  content: string;
  language: string | null;
  storagePath: string | null;
  sizeBytes: number | null;
  createdAt: string;
};

function formatDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function FilePreviewPanel({
  target,
  libraryId,
  onClose,
}: {
  target: PreviewTarget;
  libraryId: string;
  onClose: () => void;
}) {
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [board, setBoard] = useState<BoardDoc | null>(null);
  const [deck, setDeck] = useState<DeckDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [mediaError, setMediaError] = useState(false);

  const isBoard = target.type === "WHITEBOARD";
  const isDeck = target.type === "DECK";
  const isDatabase = target.type === "DATABASE";
  const isFlow = target.type === "FLOWCHART";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMediaError(false);
    setDoc(null);
    setBoard(null);
    setDeck(null);
    (async () => {
      try {
        if (isBoard) {
          const data = await apiGet<{ scene: BoardDoc }>(`/api/boards/${target.id}`);
          if (!cancelled) setBoard(data.scene);
        } else if (isDeck) {
          const data = await apiGet<{ deck: DeckDoc }>(`/api/decks/${target.id}`);
          if (!cancelled) setDeck(data.deck);
        } else {
          const data = await apiGet<DocumentDetail>(`/api/documents/${target.id}`);
          if (!cancelled) setDoc(data);
        }
      } catch {
        /* keep the header from `target`, show the unavailable state */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [target.id, isBoard, isDeck]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const type = doc?.type ?? target.type;
  const mime = doc?.mimeType ?? "";
  const rawUrl = `/api/documents/${target.id}/raw`;
  const hasFile = Boolean(doc?.storagePath) && !mediaError;

  const isImage = !mediaError && (type === "IMAGE" || mime.startsWith("image/"));
  const isVideo = !mediaError && (type === "VIDEO" || mime.startsWith("video/"));
  const isAudio = !mediaError && (type === "AUDIO" || mime.startsWith("audio/"));
  const isPdf =
    !mediaError &&
    (target.type === "PDF" || type === "PDF" || mime === "application/pdf");

  const extractedText = doc?.content && !doc.content.trimStart().startsWith("[") ? doc.content : null;
  const added = formatDate(doc?.createdAt);

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-border bg-card xl:w-96">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <FileArtwork type={type} className="size-6 shrink-0" />
        <p className="min-w-0 flex-1 truncate text-sm font-medium" title={target.title}>
          {target.title}
        </p>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close preview">
          <X className="size-4" />
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex min-h-40 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/30 p-3">
          {loading ? (
            <Skeleton className="h-40 w-full rounded-lg" />
          ) : isBoard ? (
            board ? (
              <BoardPreview scene={board} className="h-[40vh] w-full" />
            ) : (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <FileArtwork type="WHITEBOARD" className="size-20" />
                <p className="text-xs text-muted-foreground">Preview unavailable</p>
              </div>
            )
          ) : isDeck ? (
            deck ? (
              <DeckSlideSvg
                slide={deck.slides[deck.slideOrder[0]]}
                className="w-full rounded-lg border border-border"
                ariaLabel="Deck preview"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <FileArtwork type="DECK" className="size-20" />
                <p className="text-xs text-muted-foreground">Preview unavailable</p>
              </div>
            )
          ) : isDatabase || isFlow ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <FileArtwork type={type} className="size-20" />
              <p className="text-xs text-muted-foreground">Open to view and edit</p>
            </div>
          ) : hasFile && doc && isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={rawUrl}
              alt={target.title}
              className="max-h-[50vh] w-full rounded-lg object-contain"
              onError={() => setMediaError(true)}
            />
          ) : hasFile && doc && isVideo ? (
            <video
              src={rawUrl}
              controls
              className="max-h-[50vh] w-full rounded-lg"
              onError={() => setMediaError(true)}
            />
          ) : hasFile && doc && isPdf ? (
            <PdfPagePreview
              documentId={target.id}
              className="max-h-[50vh] w-full rounded-lg border border-border"
            />
          ) : hasFile && doc && isAudio ? (
            <div className="flex w-full flex-col items-center gap-4 py-6">
              <FileArtwork type="AUDIO" className="size-20" />
              <audio
                src={rawUrl}
                controls
                className="w-full"
                onError={() => setMediaError(true)}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <FileArtwork type={type} className="size-20" />
              <p className="text-xs text-muted-foreground">
                {doc?.storagePath ? "No inline preview" : "File not stored"}
              </p>
            </div>
          )}
        </div>

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Type</dt>
            <dd className="font-medium">{getDocumentLabel(type)}</dd>
          </div>
          {mime && (
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Format</dt>
              <dd className="truncate font-medium" title={mime}>
                {mime}
              </dd>
            </div>
          )}
          {formatBytes(doc?.sizeBytes) && (
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Size</dt>
              <dd className="font-medium">{formatBytes(doc?.sizeBytes)}</dd>
            </div>
          )}
          {doc?.language && (
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Language</dt>
              <dd className="font-medium">{doc.language}</dd>
            </div>
          )}
          {added && (
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Added</dt>
              <dd className="font-medium">{added}</dd>
            </div>
          )}
        </dl>

        {extractedText && (
          <div className="mt-4">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <FileText className="size-3.5" />
              Extracted text
            </p>
            <p className="line-clamp-12 whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
              {extractedText}
            </p>
          </div>
        )}
      </div>

      <footer className="flex items-center gap-2 border-t border-border px-4 py-3">
        {isBoard ? (
          <Link
            href={boardRoute(libraryId, target.id)}
            className={cn(buttonVariants({ variant: "default", size: "sm" }), "flex-1")}
          >
            <ExternalLink className="size-4" />
            Open board
          </Link>
        ) : isDeck ? (
          <Link
            href={deckRoute(libraryId, target.id)}
            className={cn(buttonVariants({ variant: "default", size: "sm" }), "flex-1")}
          >
            <ExternalLink className="size-4" />
            Open deck
          </Link>
        ) : isDatabase ? (
          <Link
            href={databaseRoute(libraryId, target.id)}
            className={cn(buttonVariants({ variant: "default", size: "sm" }), "flex-1")}
          >
            <ExternalLink className="size-4" />
            Open database
          </Link>
        ) : isFlow ? (
          <Link
            href={flowchartRoute(libraryId, target.id)}
            className={cn(buttonVariants({ variant: "default", size: "sm" }), "flex-1")}
          >
            <ExternalLink className="size-4" />
            Open flowchart
          </Link>
        ) : isPdf ? (
          <Link
            href={pdfRoute(libraryId, target.id)}
            className={cn(buttonVariants({ variant: "default", size: "sm" }), "flex-1")}
          >
            <ExternalLink className="size-4" />
            Annotate
          </Link>
        ) : (
          <>
            <a
              href={`${rawUrl}?download=1`}
              download={target.title}
              className={cn(buttonVariants({ variant: "default", size: "sm" }), "flex-1")}
            >
              <Download className="size-4" />
              Download
            </a>
            <Link
              href={documentRoute(libraryId, target.id)}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <ExternalLink className="size-4" />
              Open
            </Link>
          </>
        )}
      </footer>
    </aside>
  );
}
