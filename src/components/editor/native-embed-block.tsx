"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { createReactBlockSpec } from "@blocknote/react";
import { DatabaseBoard } from "@/components/database/database-board";
import { DatabaseCalendar } from "@/components/database/database-calendar";
import { DatabaseTable } from "@/components/database/database-table";
import { useDatabase } from "@/components/database/use-database";
import { FlowPreview } from "@/components/flowcharts/flow-preview";
import { DeckSlideSvg } from "@/components/slideshow/deck-slide-svg";
import { FileArtwork } from "@/lib/client/file-icons";
import { apiGet } from "@/lib/client/api";
import { databaseRoute, deckRoute, flowchartRoute } from "@/lib/client/routes";
import { nativeEmbedBlockConfig, type NativeEmbedKind } from "@/lib/editor/embed-block-config";
import type { Slide } from "@/lib/decks/deck-schema";
import type { FlowDoc } from "@/lib/flowcharts/flowchart-schema";
import { cn } from "@/lib/core/utils";

type EmbedProps = {
  embedKind: NativeEmbedKind;
  documentId: string;
  libraryId: string;
  title: string;
  viewId: string;
  readOnly?: boolean;
};

function EmbedChrome({
  embedKind,
  libraryId,
  documentId,
  title,
  children,
}: {
  embedKind: NativeEmbedKind;
  libraryId: string;
  documentId: string;
  title: string;
  children: React.ReactNode;
}) {
  const href =
    embedKind === "DECK"
      ? deckRoute(libraryId, documentId)
      : embedKind === "DATABASE"
        ? databaseRoute(libraryId, documentId)
        : flowchartRoute(libraryId, documentId);

  return (
    <div
      className="my-3 overflow-hidden rounded-xl border border-border bg-card"
      contentEditable={false}
    >
      <Link
        href={href}
        className="flex items-center gap-2 border-b border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/40"
      >
        <FileArtwork type={embedKind} className="size-4 shrink-0" />
        <span className="truncate">{title.trim() || "Untitled"}</span>
      </Link>
      <div className="max-h-[min(28rem,70vh)] overflow-auto">{children}</div>
    </div>
  );
}

function DeckEmbedBody({ documentId }: { documentId: string }) {
  const [slide, setSlide] = useState<Slide | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiGet<{ deck: { slideOrder: string[]; slides: Record<string, Slide> } }>(
          `/api/decks/${documentId}`
        );
        if (!cancelled) setSlide(data.deck.slides[data.deck.slideOrder[0]] ?? null);
      } catch {
        if (!cancelled) setSlide(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  if (loading) {
    return (
      <div className="flex aspect-video items-center justify-center bg-muted/30">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="aspect-video bg-muted/30 p-3">
      <div className="mx-auto h-full max-w-3xl overflow-hidden rounded-md border border-border/60">
        <DeckSlideSvg slide={slide ?? undefined} className="h-full w-full" />
      </div>
    </div>
  );
}

function FlowEmbedBody({ documentId }: { documentId: string }) {
  const [scene, setScene] = useState<FlowDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiGet<{ scene: FlowDoc }>(`/api/flowcharts/${documentId}`);
        if (!cancelled) setScene(data.scene);
      } catch {
        if (!cancelled) setScene(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center bg-muted/30">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-48 bg-muted/30 p-3">
      {scene ? (
        <FlowPreview scene={scene} className="h-full w-full" />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Flowchart unavailable
        </div>
      )}
    </div>
  );
}

function DatabaseEmbedBody({
  documentId,
  libraryId,
  viewId,
  readOnly,
}: {
  documentId: string;
  libraryId: string;
  viewId: string;
  readOnly: boolean;
}) {
  const controller = useDatabase(documentId, libraryId, readOnly);

  useEffect(() => {
    if (!viewId || !controller.scene) return;
    if (controller.scene.views.some((v) => v.id === viewId)) {
      controller.setActiveViewId(viewId);
    }
  }, [viewId, controller.scene, controller.setActiveViewId]);

  if (controller.loadError) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        Couldn&apos;t load database
      </div>
    );
  }

  if (!controller.scene) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeView = controller.scene.views.find((v) => v.id === controller.activeViewId);
  if (!activeView) return null;

  return (
    <div className="flex min-h-48 flex-col">
      {controller.scene.views.length > 1 && (
        <div className="flex gap-1 border-b border-border px-2 py-1.5">
          {controller.scene.views.map((view) => (
            <button
              key={view.id}
              type="button"
              onClick={() => controller.setActiveViewId(view.id)}
              className={cn(
                "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                controller.activeViewId === view.id
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {view.name}
            </button>
          ))}
        </div>
      )}
      <div className="min-h-0 flex-1">
        {activeView.type === "BOARD" ? (
          <DatabaseBoard controller={controller} view={activeView} />
        ) : activeView.type === "CALENDAR" ? (
          <DatabaseCalendar controller={controller} view={activeView} />
        ) : (
          <DatabaseTable controller={controller} />
        )}
      </div>
    </div>
  );
}

export function NativeEmbedCard({
  embedKind,
  documentId,
  libraryId,
  title,
  viewId,
  readOnly = true,
}: EmbedProps) {
  if (!documentId || !libraryId) {
    return (
      <div className="my-3 rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        Embedded {embedKind.toLowerCase()} unavailable
      </div>
    );
  }

  return (
    <EmbedChrome
      embedKind={embedKind}
      libraryId={libraryId}
      documentId={documentId}
      title={title}
    >
      {embedKind === "DECK" ? (
        <DeckEmbedBody documentId={documentId} />
      ) : embedKind === "FLOWCHART" ? (
        <FlowEmbedBody documentId={documentId} />
      ) : (
        <DatabaseEmbedBody
          documentId={documentId}
          libraryId={libraryId}
          viewId={viewId}
          readOnly={readOnly}
        />
      )}
    </EmbedChrome>
  );
}

export const NativeEmbed = createReactBlockSpec(nativeEmbedBlockConfig, {
  render: ({ block, editor }) => (
    <NativeEmbedCard
      embedKind={block.props.embedKind as NativeEmbedKind}
      documentId={block.props.documentId}
      libraryId={block.props.libraryId}
      title={block.props.title}
      viewId={block.props.viewId}
      readOnly={!editor.isEditable}
    />
  ),
});
