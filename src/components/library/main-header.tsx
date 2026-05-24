"use client";

import { Check, Loader2 } from "lucide-react";
import { PageCollaborators } from "@/components/editor/page-collaborators";
import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";
import { ThemeToggle } from "@/components/theme-toggle";
import type { BreadcrumbItem } from "@/lib/folders";
import type { PageCollaborator } from "@/lib/page-presence";
import { cn } from "@/lib/utils";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

type Props = {
  breadcrumbs: BreadcrumbItem[];
  hrefFor: (item: BreadcrumbItem) => string | null;
  saveStatus?: SaveStatus;
  collaborators?: PageCollaborator[];
  remoteNotice?: string | null;
};

export function MainHeader({
  breadcrumbs,
  hrefFor,
  saveStatus = "idle",
  collaborators = [],
  remoteNotice,
}: Props) {
  return (
    <header className="flex h-11 shrink-0 items-center justify-between gap-4 px-4">
      <NavBreadcrumb items={breadcrumbs} hrefFor={hrefFor} />
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
      </div>
    </header>
  );
}
