"use client";

import { FolderIcon } from "@/components/icons/folder-icon";
import { LibraryIcon } from "@/components/icons/library-icon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/core/utils";

type Props = {
  scope: "all" | "folder";
  onScopeChange: (scope: "all" | "folder") => void;
  libraryName?: string | null;
  libraryIcon?: string | null;
  folderName?: string | null;
  folderColor?: string | null;
  folderId?: string | null;
  size?: "sm" | "default";
};

function ScopeLabel({
  kind,
  libraryIcon,
  libraryName,
  folderName,
  folderColor,
}: {
  kind: "all" | "folder";
  libraryIcon?: string | null;
  libraryName?: string | null;
  folderName?: string | null;
  folderColor?: string | null;
}) {
  if (kind === "all") {
    return (
      <>
        <LibraryIcon icon={libraryIcon} className="size-4" />
        <span className="truncate">{libraryName ?? "Library"}</span>
      </>
    );
  }

  return (
    <>
      <FolderIcon color={folderColor ?? "gray"} className="size-4 shrink-0" />
      <span className="truncate">{folderName ?? "Current folder"}</span>
    </>
  );
}

export function ScopeSelect({
  scope,
  onScopeChange,
  libraryName,
  libraryIcon,
  folderName,
  folderColor,
  folderId,
  size = "default",
}: Props) {
  return (
    <Select value={scope} onValueChange={(v) => onScopeChange(v as "all" | "folder")}>
      <SelectTrigger
        size={size === "sm" ? "sm" : undefined}
        className={cn(
          "max-w-[11rem] min-w-0",
          size === "sm" && "h-8 text-xs"
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end" className="min-w-[var(--anchor-width)] w-max max-w-xs">
        <SelectItem value="all">
          <ScopeLabel
            kind="all"
            libraryIcon={libraryIcon}
            libraryName={libraryName}
          />
        </SelectItem>
        <SelectItem value="folder" disabled={!folderId}>
          <ScopeLabel
            kind="folder"
            folderName={folderName}
            folderColor={folderColor}
          />
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
