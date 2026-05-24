"use client";

import { Folder } from "lucide-react";
import { PickerOptionButton } from "@/components/modals/picker-option-button";
import { FOLDER_COLORS, type FolderColorId } from "@/lib/folder-colors";

type Props = {
  value: FolderColorId;
  onChange: (color: FolderColorId) => void;
};

export function ColorPicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {FOLDER_COLORS.map((color) => (
        <PickerOptionButton
          key={color.id}
          selected={value === color.id}
          title={color.label}
          onClick={() => onChange(color.id)}
        >
          <Folder className="size-5" style={{ color: color.hex, fill: `${color.hex}33` }} />
        </PickerOptionButton>
      ))}
    </div>
  );
}
