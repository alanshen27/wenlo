"use client";

import { Check, Loader2, Maximize2, Minimize2, PanelLeftOpen } from "lucide-react";
import { PageCollaborators } from "@/components/editor/page-collaborators";
import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";
import { Button } from "@/components/ui/button";
import type { BreadcrumbItem } from "@/lib/library/folders";
import type { PageCollaborator } from "@/lib/realtime/page-presence";
import { cn } from "@/lib/core/utils";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

type Props = {
  breadcrumbs: BreadcrumbItem[];
  hrefFor: (item: BreadcrumbItem) => string | null;
  saveStatus?: SaveStatus;
  collaborators?: PageCollaborator[];
  remoteNotice?: string | null;
  focusMode?: boolean;
  onToggleFocus?: () => void;
};

export function MainHeader({
  breadcrumbs,
  hrefFor,
  saveStatus = "idle",
  collaborators = [],
  remoteNotice,
  focusMode = false,
  onToggleFocus,
}: Props) {
  return (
    <header className="flex h-11 shrink-0 items-center justify-between gap-4 px-4">
      <div className="flex min-w-0 items-center gap-1">
        {focusMode && onToggleFocus && (
          <Button
            variant="ghost"
            size="icon-sm"
            title="Show sidebar"
            aria-label="Show sidebar"
            className="-ml-1 shrink-0"
            onClick={onToggleFocus}
          >
            <PanelLeftOpen className="size-4" />
          </Button>
        )}
        <NavBreadcrumb items={breadcrumbs} hrefFor={hrefFor} />
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {remoteNotice && (
          <span className="hidden text-xs text-muted-foreground sm:inline">{remoteNotice}</span>
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
          {saveStatus === "error" && <span className="text-destructive">Save failed</span>}
        </div>
        {onToggleFocus && (
          <Button
            variant="ghost"
            size="icon-sm"
            title={focusMode ? "Exit full screen" : "Full screen"}
            aria-label={focusMode ? "Exit full screen" : "Full screen"}
            onClick={onToggleFocus}
          >
            {focusMode ? (
              <Minimize2 className="size-4" />
            ) : (
              <Maximize2 className="size-4" />
            )}
          </Button>
        )}
      </div>
    </header>
  );
}
