"use client";

import Link from "next/link";
import { Check, ChevronLeft, Loader2 } from "lucide-react";
import { PageCollaborators } from "@/components/editor/page-collaborators";
import { FileArtwork } from "@/lib/client/file-icons";
import type { SaveStatus } from "@/components/library/main-header";
import { NATIVE_TYPES, type NativeKind } from "@/lib/native/native-types";
import { nativeHomeRoute } from "@/lib/client/routes";
import type { PageCollaborator } from "@/lib/realtime/page-presence";
import { cn } from "@/lib/core/utils";

type Props = {
  kind: NativeKind;
  title: string;
  saveStatus?: SaveStatus;
  collaborators?: PageCollaborator[];
  remoteNotice?: string | null;
};

export function StandaloneTopBar({
  kind,
  title,
  saveStatus = "idle",
  collaborators = [],
  remoteNotice,
}: Props) {
  const cfg = NATIVE_TYPES[kind];

  return (
    <header className="flex h-11 shrink-0 items-center justify-between gap-4 border-b border-sidebar-border bg-sidebar px-3 text-sidebar-foreground">
      <div className="flex min-w-0 items-center gap-2">
        <Link
          href={nativeHomeRoute(kind)}
          className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          title={`Back to ${cfg.plural}`}
        >
          <ChevronLeft className="size-4" />
          <FileArtwork type={cfg.artworkType} className="size-4" />
          <span className="hidden sm:inline">{cfg.plural}</span>
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <span className="min-w-0 truncate text-sm font-medium">
          {title || "Untitled"}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {remoteNotice && (
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {remoteNotice}
          </span>
        )}
        <PageCollaborators collaborators={collaborators} />
        <div
          className={cn(
            "flex items-center gap-1.5 text-xs transition-opacity",
            saveStatus === "idle" ? "opacity-0" : "opacity-100"
          )}
        >
          {saveStatus === "saving" && (
            <>
              <Loader2 className="size-3 animate-spin" />
              <span className="text-muted-foreground">Saving…</span>
            </>
          )}
          {saveStatus === "saved" && (
            <>
              <Check className="size-3 text-emerald-500" />
              <span className="text-muted-foreground">Saved</span>
            </>
          )}
          {saveStatus === "error" && (
            <span className="text-destructive">Save failed</span>
          )}
        </div>
      </div>
    </header>
  );
}
