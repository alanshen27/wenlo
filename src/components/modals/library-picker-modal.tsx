"use client";

import { Check } from "lucide-react";
import { LibraryIcon } from "@/components/icons/library-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Library } from "@/components/sidebar/library-switcher";
import type { LibraryPickerOptions } from "@/hooks/use-library-picker";
import { cn } from "@/lib/core/utils";

type Props = {
  open: boolean;
  options: LibraryPickerOptions | null;
  libraries: Library[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
};

export function LibraryPickerModal({
  open,
  options,
  libraries,
  selectedId,
  onSelect,
  onConfirm,
  onOpenChange,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{options?.title ?? "Choose library"}</DialogTitle>
          {options?.description && (
            <DialogDescription>{options.description}</DialogDescription>
          )}
        </DialogHeader>
        <ul className="-mx-2 max-h-72 overflow-y-auto px-2 py-1">
          {libraries.map((library) => {
            const selected = library.id === selectedId;
            return (
              <li key={library.id}>
                <button
                  type="button"
                  onClick={() => onSelect(library.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
                    selected ? "bg-muted" : "hover:bg-muted/60"
                  )}
                >
                  <LibraryIcon icon={library.icon} className="size-5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{library.name}</span>
                  {library.isShared && (
                    <Badge variant="secondary" className="h-5 shrink-0 px-1.5 text-[10px]">
                      Shared
                    </Badge>
                  )}
                  {selected && <Check className="size-4 shrink-0 text-primary" />}
                </button>
              </li>
            );
          })}
        </ul>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={!selectedId} onClick={onConfirm}>
            {options?.confirmLabel ?? "Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
