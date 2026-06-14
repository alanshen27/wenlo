"use client";

import { PickerOptionButton } from "@/components/modals/picker-option-button";
import { FolderArtwork } from "@/lib/client/file-icons";
import { FOLDER_COLORS, type FolderColorId } from "@/lib/library/folder-colors";

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
          <FolderArtwork color={color.id} className="size-6" />
        </PickerOptionButton>
      ))}
    </div>
  );
}
