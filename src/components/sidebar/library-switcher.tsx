"use client";

import { Check, ChevronDown, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LibraryRole } from "@/lib/library/library-access";

export type Library = {
  id: string;
  name: string;
  icon: string;
  role?: LibraryRole;
  isShared?: boolean;
};

type Props = {
  libraries: Library[];
  activeLibraryId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onShare?: () => void;
};

export function LibrarySwitcher({
  libraries,
  activeLibraryId,
  onSelect,
  onCreate,
  onShare,
}: Props) {
  const active = libraries.find((l) => l.id === activeLibraryId) ?? libraries[0];
  const canShare = active?.role === "OWNER";

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
        {active?.isShared && (
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
            Shared
          </Badge>
        )}
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {libraries.map((library) => (
          <DropdownMenuItem key={library.id} onClick={() => onSelect(library.id)}>
            <span>{library.icon}</span>
            <span className="flex-1 truncate">{library.name}</span>
            {library.isShared && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                Shared
              </Badge>
            )}
            {library.id === activeLibraryId && <Check className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        {canShare && onShare && (
          <DropdownMenuItem onClick={onShare}>
            <Users className="size-4" />
            Share workspace
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onCreate}>
          <Plus className="size-4" />
          New library
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
