"use client";

import { Check, ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type Library = {
  id: string;
  name: string;
  icon: string;
};

type Props = {
  libraries: Library[];
  activeLibraryId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
};

export function LibrarySwitcher({ libraries, activeLibraryId, onSelect, onCreate }: Props) {
  const active = libraries.find((l) => l.id === activeLibraryId) ?? libraries[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="h-9 w-full justify-start gap-2 px-2 font-medium"
          />
        }
      >
        <span className="text-base leading-none">{active?.icon ?? "📚"}</span>
        <span className="min-w-0 flex-1 truncate text-left">{active?.name ?? "Library"}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {libraries.map((library) => (
          <DropdownMenuItem key={library.id} onClick={() => onSelect(library.id)}>
            <span>{library.icon}</span>
            <span className="flex-1 truncate">{library.name}</span>
            {library.id === activeLibraryId && <Check className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onCreate}>
          <Plus className="size-4" />
          New library
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
