"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  selected: boolean;
  onClick: () => void;
  title?: string;
  children: ReactNode;
};

export function PickerOptionButton({ selected, onClick, title, children }: Props) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      title={title}
      onClick={onClick}
      className={cn(selected ? "border-foreground ring-1 ring-foreground" : "border-transparent")}
    >
      {children}
    </Button>
  );
}
