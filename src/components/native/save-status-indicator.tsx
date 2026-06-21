"use client";

import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/core/utils";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

type Props = {
  status: SaveStatus;
  className?: string;
};

/** Inline save status chip shared by library and standalone native headers. */
export function SaveStatusIndicator({ status, className }: Props) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-sm transition-opacity",
        status === "idle" ? "opacity-0" : "opacity-100",
        className
      )}
      aria-live={status === "saving" || status === "error" ? "polite" : undefined}
    >
      {status === "saving" && (
        <>
          <Loader2 className="size-3.5 animate-spin" />
          <span className="text-muted-foreground">Saving…</span>
        </>
      )}
      {status === "saved" && (
        <>
          <Check className="size-3.5 text-emerald-500" />
          <span className="text-muted-foreground">Saved</span>
        </>
      )}
      {status === "error" && <span className="text-destructive">Save failed</span>}
    </div>
  );
}
