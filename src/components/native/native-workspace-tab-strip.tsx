"use client";

import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/core/utils";
import type { NativeWorkspaceTab } from "@/hooks/use-native-workspace-tabs";

type Props = {
  tabs: NativeWorkspaceTab[];
  activeId?: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onAdd?: () => void;
  addLabel?: string;
  adding?: boolean;
  className?: string;
};

export function NativeWorkspaceTabStrip({
  tabs,
  activeId,
  onSelect,
  onClose,
  onAdd,
  addLabel,
  adding = false,
  className,
}: Props) {
  if (tabs.length === 0 && !onAdd) return null;

  return (
    <div
      role="tablist"
      aria-label="Open documents"
      className={cn(
        "flex min-w-0 flex-1 items-end gap-1 overflow-x-auto pb-0 scrollbar-none",
        className
      )}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <div
            key={tab.id}
            role="presentation"
            className={cn(
              "group/tab relative flex max-w-[240px] min-w-[7.5rem] shrink-0 items-center",
              active ? "z-10 -mb-px h-9" : "h-8"
            )}
          >
            <button
              type="button"
              role="tab"
              aria-selected={active}
              title={tab.title}
              onClick={() => onSelect(tab.id)}
              className={cn(
                "flex h-full min-w-0 flex-1 items-center gap-2 truncate pl-3 text-sm outline-none transition-colors",
                active
                  ? "rounded-t-lg border border-border border-b-background bg-background pr-8 font-medium text-foreground"
                  : "rounded-t-md pr-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <span className="truncate">{tab.title}</span>
            </button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`Close ${tab.title}`}
              onClick={(e) => {
                e.stopPropagation();
                onClose(tab.id);
              }}
              className={cn(
                "absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground hover:text-foreground",
                active ? "opacity-100" : "opacity-0 group-hover/tab:opacity-100"
              )}
            >
              <X className="size-3" />
            </Button>
          </div>
        );
      })}

      {onAdd && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onAdd}
          disabled={adding}
          aria-label={addLabel}
          title={addLabel}
          className="size-8 shrink-0 text-muted-foreground"
        >
          {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        </Button>
      )}
    </div>
  );
}
