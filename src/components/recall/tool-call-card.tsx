"use client";

import { useState } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import type {
  RecallToolCallBlock,
  RecallToolResultBlock,
} from "@/lib/recall-chat/recall-tool-blocks";
import { cn } from "@/lib/core/utils";

function summarizeArgs(args: Record<string, unknown>): string {
  const parts = Object.entries(args)
    .slice(0, 2)
    .map(([key, value]) => {
      const text = typeof value === "string" ? value : JSON.stringify(value);
      const clipped = text.length > 36 ? `${text.slice(0, 33)}…` : text;
      return `${key}: ${clipped}`;
    });
  return parts.join(" · ") || "—";
}

export function ToolIOPair({
  call,
  result,
  pending,
}: {
  call: RecallToolCallBlock;
  result: RecallToolResultBlock | null;
  pending?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const failed = Boolean(result?.isError);
  const waiting = pending || !result;

  return (
    <div className="my-1 first:mt-0 last:mb-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full min-w-0 items-center gap-1 py-0.5 text-left text-[11px] leading-snug",
          failed ? "text-destructive/80 hover:text-destructive" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <ChevronRight
          className={cn(
            "size-3 shrink-0 transition-transform duration-150",
            open && "rotate-90"
          )}
        />
        <span className="shrink-0 font-medium">{call.name}</span>
        <span className="min-w-0 truncate opacity-80">{summarizeArgs(call.arguments)}</span>
        {waiting ? <Loader2 className="size-3 shrink-0 animate-spin opacity-70" /> : null}
      </button>
      {open ? (
        <div className="space-y-1.5 py-1 pl-4">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60">
              in
            </p>
            <pre className="max-h-36 overflow-auto font-mono text-[10px] leading-relaxed text-muted-foreground">
              {JSON.stringify(call.arguments, null, 2)}
            </pre>
          </div>
          <div>
            <p
              className={cn(
                "text-[10px] font-medium uppercase tracking-wide",
                failed ? "text-destructive/60" : "text-muted-foreground/60"
              )}
            >
              out
            </p>
            {waiting ? (
              <p className="text-[10px] text-muted-foreground/70">…</p>
            ) : (
              <pre
                className={cn(
                  "max-h-44 overflow-auto font-mono text-[10px] leading-relaxed",
                  failed ? "text-destructive/80" : "text-muted-foreground"
                )}
              >
                {JSON.stringify(result?.result, null, 2)}
              </pre>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
