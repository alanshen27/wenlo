"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { PdfAnnotationSvg } from "@/components/pdf/pdf-annotation-svg";
import { FileArtwork } from "@/lib/client/file-icons";
import { apiGet } from "@/lib/client/api";
import { loadPdfJs, type PdfDocumentProxy } from "@/lib/pdfs/pdf-js";
import {
  createEmptyPageAnnotations,
  normalizePdfAnnotations,
  type PdfAnnotationDoc,
} from "@/lib/pdfs/pdf-annotation-schema";
import { cn } from "@/lib/core/utils";

const pdfDocCache = new Map<string, Promise<PdfDocumentProxy>>();
const annCache = new Map<string, PdfAnnotationDoc>();

function loadPdfDoc(documentId: string): Promise<PdfDocumentProxy> {
  let pending = pdfDocCache.get(documentId);
  if (!pending) {
    pending = loadPdfJs()
      .then((pdfjs) =>
        pdfjs
          .getDocument({
            url: `/api/documents/${documentId}/raw`,
            withCredentials: true,
          })
          .promise
      )
      .catch((err) => {
        pdfDocCache.delete(documentId);
        throw err;
      });
    pdfDocCache.set(documentId, pending);
  }
  return pending;
}

async function loadAnnotations(documentId: string): Promise<PdfAnnotationDoc> {
  const cached = annCache.get(documentId);
  if (cached) return cached;
  const ann = await apiGet<PdfAnnotationDoc>(`/api/documents/${documentId}/annotations`);
  const normalized = normalizePdfAnnotations(ann);
  annCache.set(documentId, normalized);
  return normalized;
}

/** Read-only single-page PDF render with annotation overlay. */
export function PdfPagePreview({
  documentId,
  pageNumber = 1,
  className,
}: {
  documentId: string;
  pageNumber?: number;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [pdfDoc, setPdfDoc] = useState<PdfDocumentProxy | null>(null);
  const [annotations, setAnnotations] = useState<PdfAnnotationDoc | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setPdfDoc(null);
    setAnnotations(null);
    void Promise.all([loadPdfDoc(documentId), loadAnnotations(documentId)])
      .then(([doc, ann]) => {
        if (cancelled) return;
        setPdfDoc(doc);
        setAnnotations(ann);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry?.contentRect.width ?? 0);
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (status !== "ready" || !pdfDoc || containerWidth <= 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (cancelled) return;
        const unscaled = page.getViewport({ scale: 1 });
        const scale = containerWidth / unscaled.width;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        setDimensions({ width: viewport.width, height: viewport.height });
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        await page.render({ canvasContext: ctx, canvas, viewport }).promise;
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, pdfDoc, pageNumber, containerWidth]);

  if (status === "error") {
    return (
      <div className={cn("flex size-full items-center justify-center", className)}>
        <FileArtwork type="PDF" className="size-14" />
      </div>
    );
  }

  if (status === "loading" || !annotations) {
    return (
      <div className={cn("flex size-full items-center justify-center", className)}>
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pageKey = String(pageNumber);
  const pageAnn = annotations.pages[pageKey] ?? createEmptyPageAnnotations();

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full overflow-hidden bg-white", className)}
    >
      <canvas ref={canvasRef} className="block w-full" />
      <PdfAnnotationSvg
        elements={pageAnn.elements}
        elementOrder={pageAnn.elementOrder}
        width={dimensions.width}
        height={dimensions.height}
        readOnly
      />
    </div>
  );
}

/** Thumbnail wrapper for library cards and native home recents. */
export function PdfPreviewThumb({ documentId }: { documentId: string }) {
  return (
    <div className="absolute inset-0 flex items-start justify-center overflow-hidden bg-white p-1.5">
      <PdfPagePreview documentId={documentId} className="shadow-sm ring-1 ring-border/40" />
    </div>
  );
}
