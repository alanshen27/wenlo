"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  scope: "all" | "folder";
  onScopeChange: (scope: "all" | "folder") => void;
  libraryName?: string | null;
  folderName?: string | null;
  folderId?: string | null;
  size?: "sm" | "default";
};

export function ScopeSelect({
  scope,
  onScopeChange,
  libraryName,
  folderName,
  folderId,
  size = "default",
}: Props) {
  return (
    <Select value={scope} onValueChange={(v) => onScopeChange(v as "all" | "folder")}>
      <SelectTrigger size={size === "sm" ? "sm" : undefined} className={size === "sm" ? "h-8 text-xs" : undefined}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="all">
          Entire library{libraryName ? `: ${libraryName}` : ""}
        </SelectItem>
        <SelectItem value="folder" disabled={!folderId}>
          {folderName ? `Folder: ${folderName}` : "Current folder"}
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
