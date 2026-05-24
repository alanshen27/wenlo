"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RecallResult } from "@/lib/types";

type Props = {
  result: RecallResult;
  onOpen: (result: RecallResult) => void;
  compact?: boolean;
};

export function SearchResultCard({ result, onOpen, compact }: Props) {
  return (
    <Button
      variant="outline"
      className="h-auto w-full min-w-0 flex-col items-stretch gap-1.5 overflow-hidden p-3 text-left font-normal"
      onClick={() => onOpen(result)}
    >
      <div className="flex w-full min-w-0 items-start justify-between gap-2">
        <span className="min-w-0 flex-1 truncate font-medium text-foreground">{result.title}</span>
        <MatchBadge matchType={result.matchType} />
      </div>
      {!compact && (
        <span className="truncate text-xs capitalize text-muted-foreground">{result.sourceType}</span>
      )}
      <span className="line-clamp-2 w-full min-w-0 text-sm text-muted-foreground">{result.snippet}</span>
    </Button>
  );
}

function MatchBadge({ matchType }: { matchType: RecallResult["matchType"] }) {
  const label =
    matchType === "both" ? "keyword + semantic" : matchType === "semantic" ? "semantic" : "keyword";
  return (
    <Badge variant="secondary" className="shrink-0 text-[10px] font-normal">
      {label}
    </Badge>
  );
}
