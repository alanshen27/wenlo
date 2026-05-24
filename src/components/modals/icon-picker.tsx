"use client";

import { PickerOptionButton } from "@/components/modals/picker-option-button";
import { LIBRARY_ICONS } from "@/lib/folder-colors";

type Props = {
  value: string;
  onChange: (icon: string) => void;
};

export function IconPicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {LIBRARY_ICONS.map((emoji) => (
        <PickerOptionButton
          key={emoji}
          selected={value === emoji}
          title={emoji}
          onClick={() => onChange(emoji)}
        >
          <span className="text-base leading-none">{emoji}</span>
        </PickerOptionButton>
      ))}
    </div>
  );
}
