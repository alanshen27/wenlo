"use client";

import { Maximize2, Menu, Minimize2, PanelLeftOpen } from "lucide-react";
import { PageCollaborators } from "@/components/editor/page-collaborators";
import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";
import { SaveStatusIndicator, type SaveStatus } from "@/components/native/save-status-indicator";
import { Button } from "@/components/ui/button";
import type { BreadcrumbItem } from "@/lib/library/folders";
import type { PageCollaborator } from "@/lib/realtime/page-presence";

export type { SaveStatus };

type Props = {
  breadcrumbs: BreadcrumbItem[];
  hrefFor: (item: BreadcrumbItem) => string | null;
  saveStatus?: SaveStatus;
  collaborators?: PageCollaborator[];
  remoteNotice?: string | null;
  focusMode?: boolean;
  onToggleFocus?: () => void;
  onOpenNav?: () => void;
};

export function MainHeader({
  breadcrumbs,
  hrefFor,
  saveStatus = "idle",
  collaborators = [],
  remoteNotice,
  focusMode = false,
  onToggleFocus,
  onOpenNav,
}: Props) {
  return (
    <header className="flex h-11 shrink-0 items-center justify-between gap-4 px-4">
      <div className="flex min-w-0 items-center gap-1">
        {onOpenNav && (
          <Button
            variant="ghost"
            size="icon-sm"
            title="Open menu"
            aria-label="Open menu"
            className="-ml-1 shrink-0 md:hidden"
            onClick={onOpenNav}
          >
            <Menu className="size-4" />
          </Button>
        )}
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
        <SaveStatusIndicator status={saveStatus} />
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
