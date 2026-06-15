"use client";

import { useState } from "react";
import {
  ArrowBigRight,
  Circle,
  Diamond,
  Hexagon,
  Minus,
  Octagon,
  Pentagon,
  Shapes,
  Square,
  Star,
  Triangle,
  type LucideIcon,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/core/utils";
import type { ShapeKind } from "@/lib/canvas/shapes";

export const SHAPE_ITEMS: { id: ShapeKind; label: string; icon: LucideIcon }[] = [
  { id: "rect", label: "Rectangle", icon: Square },
  { id: "ellipse", label: "Ellipse", icon: Circle },
  { id: "line", label: "Line", icon: Minus },
  { id: "triangle", label: "Triangle", icon: Triangle },
  { id: "diamond", label: "Diamond", icon: Diamond },
  { id: "pentagon", label: "Pentagon", icon: Pentagon },
  { id: "hexagon", label: "Hexagon", icon: Hexagon },
  { id: "octagon", label: "Octagon", icon: Octagon },
  { id: "star", label: "Star", icon: Star },
  { id: "rightArrow", label: "Arrow block", icon: ArrowBigRight },
];

const SHAPE_ICONS = Object.fromEntries(SHAPE_ITEMS.map((s) => [s.id, s.icon])) as Record<
  ShapeKind,
  LucideIcon
>;

const iconBtn =
  "flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40";
const activeCls = "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary";

/**
 * Toolbar control for picking a shape. Shows the active shape's icon when a
 * shape tool is selected, otherwise a generic shapes glyph. Opening reveals a
 * grid of all shapes; picking one selects that drawing tool.
 */
export function ShapePicker({
  value,
  onSelect,
  disabled,
}: {
  value: ShapeKind | null;
  onSelect: (shape: ShapeKind) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const TriggerIcon = value ? SHAPE_ICONS[value] : Shapes;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        aria-label="Shapes"
        aria-pressed={value !== null}
        className={cn(iconBtn, value !== null && activeCls)}
      >
        <TriggerIcon className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="center" sideOffset={6} className="w-auto">
        <div className="grid grid-cols-5 gap-1">
          {SHAPE_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              title={label}
              aria-label={label}
              aria-pressed={value === id}
              onClick={() => {
                onSelect(id);
                setOpen(false);
              }}
              className={cn(iconBtn, value === id && activeCls)}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
