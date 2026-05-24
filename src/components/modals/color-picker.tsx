"use client";

import { Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FOLDER_COLORS, type FolderColorId } from "@/lib/folder-colors";

type Props = {
  value: FolderColorId;
  onChange: (color: FolderColorId) => void;
};

export function ColorPicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {FOLDER_COLORS.map((color) => (
        <Button
          key={color.id}
          type="button"
          variant="outline"
          size="icon-sm"
          title={color.label}
          onClick={() => onChange(color.id)}
          className={cn(
            "size-8",
            value === color.id ? "border-foreground ring-1 ring-foreground" : "border-transparent"
          )}
        >
          <Folder className="size-5" style={{ color: color.hex, fill: `${color.hex}33` }} />
        </Button>
      ))}
    </div>
  );
}
