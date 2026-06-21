"use client";

import type { LibraryStorageUsage } from "@/lib/client/me";
import { cn, formatBytes } from "@/lib/core/utils";

/**
 * Per-library storage bars. The plan caps storage per library, so each row is
 * its own quota rather than a single account-wide total.
 */
export function StorageUsage({
  storage,
  className,
}: {
  storage: LibraryStorageUsage[];
  className?: string;
}) {
  if (!storage || storage.length === 0) {
    return <p className="text-sm text-muted-foreground">No storage used yet.</p>;
  }

  return (
    <ul className={cn("space-y-3", className)}>
      {storage.map((s) => {
        const nearLimit = s.usagePercent >= 80;
        const atLimit = s.usagePercent >= 100;
        return (
          <li key={s.libraryId} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-muted-foreground">{s.libraryName}</span>
              <span
                className={cn(
                  "shrink-0 tabular-nums text-muted-foreground",
                  atLimit && "text-destructive",
                  nearLimit && !atLimit && "text-amber-600 dark:text-amber-400"
                )}
              >
                {formatBytes(s.usedBytes) ?? "0 B"} / {formatBytes(s.limitBytes) ?? "0 B"}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  atLimit ? "bg-destructive" : nearLimit ? "bg-amber-500" : "bg-primary"
                )}
                style={{ width: `${Math.min(100, s.usagePercent)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
