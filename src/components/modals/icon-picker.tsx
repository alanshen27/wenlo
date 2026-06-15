"use client";

import { PickerOptionButton } from "@/components/modals/picker-option-button";
import { LibraryIcon, LIBRARY_ICON_DEFS } from "@/components/icons/library-icon";

type Props = {
  value: string;
  onChange: (icon: string) => void;
};

export function IconPicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {LIBRARY_ICON_DEFS.map((def) => (
        <PickerOptionButton
          key={def.id}
          selected={value === def.id}
          title={def.label}
          onClick={() => onChange(def.id)}
        >
          <LibraryIcon icon={def.id} className="size-6" />
        </PickerOptionButton>
      ))}
    </div>
  );
}
