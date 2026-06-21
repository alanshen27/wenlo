"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { Download, Loader2 } from "lucide-react";
import { useLibraryHeader, useLibraryScope } from "@/components/library/context";
import { useDocumentHeader } from "@/hooks/use-document-header";
import { useDebouncedFlush } from "@/hooks/use-debounced-persist";
import { useSaveStatus } from "@/hooks/use-save-status";
import { ViewError } from "@/components/ui/view";
import { apiGet, apiPatch, getApiErrorMessage, isNotFoundError } from "@/lib/client/api";
import { nativeHomeRoute, pdfRoute } from "@/lib/client/routes";
import { loadPdfJs, type PdfDocumentProxy } from "@/lib/pdfs/pdf-js";
import {
  applyPdfAnnotationPatch,
  createEmptyPageAnnotations,
  createEmptyPdfAnnotations,
  normalizePdfAnnotations,
  PDF_DEFAULTS,
  type PdfAnnotationDoc,
  type PdfAnnotationElement,
  type PdfAnnotationPatch,
  type PdfPagePatch,
} from "@/lib/pdfs/pdf-annotation-schema";
import type { PdfTool } from "@/components/pdf/pdf-toolbar";

const PdfPage = dynamic(
  () => import("@/components/pdf/pdf-page").then((m) => m.PdfPage),
  { ssr: false }
);

const PdfToolbar = dynamic(
  () => import("@/components/pdf/pdf-toolbar").then((m) => m.PdfToolbar),
  { ssr: false }
);

const SAVE_DEBOUNCE_MS = 600;
const VISIBILITY_BUFFER = 2;

type PdfDocument = {
  id: string;
  title: string;
  mimeType: string | null;
  storagePath: string | null;
  folderId: string | null;
  libraryId: string;
};

function mergePdfPatch(base: PdfAnnotationPatch | null, next: PdfAnnotationPatch): PdfAnnotationPatch {
  const merged: PdfAnnotationPatch = { pages: { ...(base?.pages ?? {}) } };
  if (next.pages) {
    for (const [pageKey, pagePatch] of Object.entries(next.pages)) {
      const existing = merged.pages![pageKey] ?? {};
      const combined: PdfPagePatch = {
        upserts: { ...(existing.upserts ?? {}) },
        deletes: [...(existing.deletes ?? [])],
      };
      if (pagePatch.upserts) {
        for (const [id, el] of Object.entries(pagePatch.upserts)) {
          combined.upserts![id] = el;
          combined.deletes = combined.deletes!.filter((d) => d !== id);
        }
      }
      if (pagePatch.deletes) {
        for (const id of pagePatch.deletes) {
          delete combined.upserts![id];
          if (!combined.deletes!.includes(id)) combined.deletes!.push(id);
        }
      }
      if (pagePatch.elementOrder) combined.elementOrder = pagePatch.elementOrder;
      else if (existing.elementOrder) combined.elementOrder = existing.elementOrder;
      if (Object.keys(combined.upserts!).length === 0) delete combined.upserts;
      if (combined.deletes!.length === 0) delete combined.deletes;
      merged.pages![pageKey] = combined;
    }
  }
  return merged;
}

function useVisiblePages(pageCount: number, scrollRoot: React.RefObject<HTMLElement | null>) {
  const [visible, setVisible] = useState<Set<number>>(() => new Set([1, 2, 3]));

  useEffect(() => {
    const root = scrollRoot.current;
    if (!root || pageCount === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        setVisible((prev) => {
          const next = new Set(prev);
          for (const entry of entries) {
            const page = Number((entry.target as HTMLElement).dataset.page);
            if (!page) continue;
            if (entry.isIntersecting) {
              next.add(page);
              for (let d = 1; d <= VISIBILITY_BUFFER; d++) {
                if (page - d >= 1) next.add(page - d);
                if (page + d <= pageCount) next.add(page + d);
              }
            }
          }
          return next;
        });
      },
      { root, rootMargin: "400px 0px", threshold: 0 }
    );

    const nodes = root.querySelectorAll("[data-page]");
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [pageCount, scrollRoot]);

  return visible;
}

function activeColor(tool: PdfTool, ink: string, highlight: string, note: string): string {
  if (tool === "pen") return ink;
  if (tool === "highlight") return highlight;
  if (tool === "note") return note;
  return ink;
}

function findElement(
  doc: PdfAnnotationDoc,
  id: string
): { pageKey: string; el: PdfAnnotationElement } | null {
  for (const [pageKey, page] of Object.entries(doc.pages)) {
    const el = page.elements[id];
    if (el) return { pageKey, el };
  }
  return null;
}

export function PdfView() {
  const router = useRouter();
  const { pdfId } = useParams<{ pdfId: string }>();
  const { libraryId, canEdit } = useLibraryScope();
  const { setHeader } = useLibraryHeader();
  const { saveStatus, markSaving, markSaved, markError } = useSaveStatus();
  const readOnly = !canEdit;

  const [document, setDocument] = useState<PdfDocument | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PdfDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [annotations, setAnnotations] = useState<PdfAnnotationDoc>(createEmptyPdfAnnotations());
  const [tool, setTool] = useState<PdfTool>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [inkColor, setInkColor] = useState<string>(PDF_DEFAULTS.inkStroke);
  const [inkWidth, setInkWidth] = useState<number>(PDF_DEFAULTS.inkStrokeWidth);
  const [highlightColor, setHighlightColor] = useState<string>(PDF_DEFAULTS.highlightColor);
  const [highlightWidth, setHighlightWidth] = useState<number>(PDF_DEFAULTS.highlightStrokeWidth);
  const [noteColor, setNoteColor] = useState<string>(PDF_DEFAULTS.noteFill);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<PdfAnnotationPatch | null>(null);
  const visiblePages = useVisiblePages(pageCount, scrollRef);

  const rawUrl = `/api/documents/${pdfId}/raw`;

  useEffect(() => {
    let cancelled = false;
    setDocument(null);
    setLoadError(null);
    setPdfDoc(null);
    (async () => {
      try {
        const doc = await apiGet<PdfDocument>(`/api/documents/${pdfId}`);
        if (cancelled) return;
        if (doc.mimeType !== "application/pdf" || !doc.storagePath) {
          setLoadError("This file isn't a readable PDF.");
          return;
        }
        if (doc.libraryId !== libraryId) {
          router.replace(pdfRoute(doc.libraryId, doc.id));
          return;
        }
        setDocument(doc);
      } catch (err) {
        if (cancelled) return;
        if (isNotFoundError(err)) {
          router.replace(nativeHomeRoute("pdfs"));
          return;
        }
        setLoadError(getApiErrorMessage(err, "We couldn't load this PDF."));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfId, libraryId, router]);

  useEffect(() => {
    if (!document) return;
    let cancelled = false;
    (async () => {
      try {
        const [pdfjs, ann] = await Promise.all([
          loadPdfJs(),
          apiGet<PdfAnnotationDoc>(`/api/documents/${pdfId}/annotations`),
        ]);
        if (cancelled) return;
        const task = pdfjs.getDocument({ url: rawUrl, withCredentials: true });
        const loaded = await task.promise;
        if (cancelled) return;
        setPdfDoc(loaded);
        setPageCount(loaded.numPages);
        setAnnotations(normalizePdfAnnotations(ann));
      } catch {
        if (!cancelled) setLoadError("Couldn't render this PDF.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [document, pdfId, rawUrl]);

  const flush = useCallback(() => {
    const patch = pendingRef.current;
    pendingRef.current = null;
    if (!patch || readOnly) return;
    markSaving();
    void apiPatch(`/api/documents/${pdfId}/annotations`, { patch })
      .then(() => markSaved())
      .catch(() => markError());
  }, [pdfId, readOnly, markSaving, markSaved, markError]);

  const { schedule } = useDebouncedFlush(flush, SAVE_DEBOUNCE_MS);

  const applyPatch = useCallback(
    (patch: PdfAnnotationPatch) => {
      setAnnotations((prev) => applyPdfAnnotationPatch(prev, patch));
      pendingRef.current = mergePdfPatch(pendingRef.current, patch);
      schedule();
    },
    [schedule]
  );

  const handlePagePatch = useCallback(
    (pageKey: string, pagePatch: PdfPagePatch) => {
      if (selectedId && pagePatch.deletes?.includes(selectedId)) {
        setSelectedId(null);
        setEditingId(null);
      }
      applyPatch({ pages: { [pageKey]: pagePatch } });
    },
    [applyPatch, selectedId]
  );

  const handleDelete = useCallback(() => {
    if (!selectedId) return;
    const hit = findElement(annotations, selectedId);
    if (!hit) return;
    applyPatch({ pages: { [hit.pageKey]: { deletes: [selectedId] } } });
    setSelectedId(null);
    setEditingId(null);
  }, [selectedId, annotations, applyPatch]);

  const onSetEditing = useCallback((id: string | null) => {
    setEditingId(id);
    if (id) setTool("select");
  }, []);

  const handleSelect = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      if (!id) return;
      const hit = findElement(annotations, id);
      if (!hit) return;
      if (hit.el.type === "ink") {
        setInkColor(hit.el.stroke);
        setInkWidth(hit.el.strokeWidth);
      }
      if (hit.el.type === "highlight") {
        setHighlightColor(hit.el.color);
        setHighlightWidth(hit.el.strokeWidth);
      }
      if (hit.el.type === "note") setNoteColor(hit.el.color ?? PDF_DEFAULTS.noteFill);
    },
    [annotations]
  );

  const handleColorChange = useCallback(
    (color: string) => {
      if (tool === "pen") setInkColor(color);
      else if (tool === "highlight") setHighlightColor(color);
      else if (tool === "note") setNoteColor(color);

      if (!selectedId || readOnly) return;
      const hit = findElement(annotations, selectedId);
      if (!hit) return;
      let next: PdfAnnotationElement | null = null;
      if (hit.el.type === "ink" && (tool === "pen" || tool === "select")) {
        next = { ...hit.el, stroke: color };
        setInkColor(color);
      } else if (hit.el.type === "highlight" && (tool === "highlight" || tool === "select")) {
        next = { ...hit.el, color };
        setHighlightColor(color);
      } else if (hit.el.type === "note" && (tool === "note" || tool === "select")) {
        next = { ...hit.el, color };
        setNoteColor(color);
      }
      if (next) {
        applyPatch({ pages: { [hit.pageKey]: { upserts: { [selectedId]: next } } } });
      }
    },
    [tool, selectedId, readOnly, annotations, applyPatch]
  );

  const handleStrokeWidthChange = useCallback(
    (width: number) => {
      if (tool === "pen") setInkWidth(width);
      else if (tool === "highlight") setHighlightWidth(width);

      if (!selectedId || readOnly) return;
      const hit = findElement(annotations, selectedId);
      if (!hit) return;
      let next: PdfAnnotationElement | null = null;
      if (hit.el.type === "ink" && (tool === "pen" || tool === "select")) {
        next = { ...hit.el, strokeWidth: width };
        setInkWidth(width);
      } else if (hit.el.type === "highlight" && (tool === "highlight" || tool === "select")) {
        next = { ...hit.el, strokeWidth: width };
        setHighlightWidth(width);
      }
      if (next) {
        applyPatch({ pages: { [hit.pageKey]: { upserts: { [selectedId]: next } } } });
      }
    },
    [tool, selectedId, readOnly, annotations, applyPatch]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId && !readOnly) {
          e.preventDefault();
          handleDelete();
        }
        return;
      }

      if (readOnly) return;
      const shortcuts: Record<string, PdfTool> = {
        v: "select",
        p: "pen",
        h: "highlight",
        n: "note",
        e: "eraser",
      };
      const next = shortcuts[e.key.toLowerCase()];
      if (next) {
        e.preventDefault();
        setTool(next);
        setSelectedId(null);
        setEditingId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId, readOnly, handleDelete]);

  useEffect(() => {
    if (editingId && tool !== "select") {
      setEditingId(null);
    }
  }, [tool, editingId]);

  const headerState = useMemo(
    () =>
      document
        ? {
            saveStatus,
            titleOverride: document.title,
            folderIdFallback: document.folderId,
          }
        : undefined,
    [document, saveStatus]
  );

  useDocumentHeader(setHeader, headerState);

  if (loadError) {
    return (
      <ViewError
        title="Couldn't load this PDF"
        message={loadError}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (!document || !pdfDoc) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const selectionKind = selectedId
    ? (findElement(annotations, selectedId)?.el.type ?? null)
    : null;
  const toolbarColor =
    tool === "select" && selectionKind === "ink"
      ? inkColor
      : tool === "select" && selectionKind === "highlight"
        ? highlightColor
        : tool === "select" && selectionKind === "note"
          ? noteColor
          : activeColor(tool, inkColor, highlightColor, noteColor);
  const toolbarWidth =
    tool === "pen" || (tool === "select" && selectionKind === "ink")
      ? inkWidth
      : tool === "highlight" || (tool === "select" && selectionKind === "highlight")
        ? highlightWidth
        : inkWidth;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
        <div className="flex min-w-0 flex-1 items-center justify-center">
          {!readOnly ? (
            <PdfToolbar
              tool={tool}
              onToolChange={(t) => {
                setTool(t);
                setSelectedId(null);
                setEditingId(null);
              }}
              color={toolbarColor}
              onColorChange={handleColorChange}
              strokeWidth={toolbarWidth}
              onStrokeWidthChange={handleStrokeWidthChange}
              selectionKind={selectionKind}
              hasSelection={Boolean(selectedId)}
              onDelete={handleDelete}
            />
          ) : (
            <span className="text-xs text-muted-foreground">Annotations (read-only)</span>
          )}
        </div>
        <a
          href={`${rawUrl}?download=1`}
          download={document.title}
          title="Download original PDF"
          className="inline-flex shrink-0 items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
        >
          <Download className="size-4" />
          <span className="hidden sm:inline">Original</span>
        </a>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-muted/30 py-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4">
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((pageNumber) => {
            const pageKey = String(pageNumber);
            const pageAnnotations = annotations.pages[pageKey] ?? createEmptyPageAnnotations();
            return (
              <PdfPage
                key={pageNumber}
                pageNumber={pageNumber}
                pdfDoc={pdfDoc}
                pageAnnotations={pageAnnotations}
                tool={tool}
                selectedId={selectedId}
                editingId={editingId}
                readOnly={readOnly}
                visible={visiblePages.has(pageNumber)}
                inkColor={inkColor}
                inkWidth={inkWidth}
                highlightColor={highlightColor}
                highlightWidth={highlightWidth}
                noteColor={noteColor}
                eraserRadius={PDF_DEFAULTS.eraserRadius}
                onSelect={handleSelect}
                onSetEditing={onSetEditing}
                onPatch={(patch) => handlePagePatch(pageKey, patch)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
