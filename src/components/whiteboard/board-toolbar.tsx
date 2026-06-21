"use client";

import type { ComponentProps } from "react";
import {
  ArrowUpRight,
  Ban,
  BringToFront,
  Hand,
  Image as ImageIcon,
  MousePointer2,
  PaintBucket,
  Pencil,
  SendToBack,
  Spline,
  StickyNote,
  Trash2,
  Type,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/blocknote-ui/tooltip";
import { cn } from "@/lib/core/utils";
import { ShapePicker } from "@/components/canvas/shape-picker";
import { CaptionField, TextFormatControls } from "@/components/canvas/text-format-controls";
import type { ShapeKind } from "@/lib/canvas/shapes";
import type { SceneElement } from "@/lib/scene/elements";

/** Sentinel for "no fill" (transparent) so shapes can be outline-only. */
export const NO_FILL = "transparent";

/** Icon button with a hover tooltip; used for tools and selection actions. */
function TipButton({
  label,
  children,
  className,
  ...props
}: ComponentProps<"button"> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label={label} className={className} {...props}>
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

export type Tool =
  | "select"
  | "pan"
  | "pen"
  | "arrow"
  | "connector"
  | "text"
  | "sticky"
  | "image"
  | ShapeKind;

/** Non-shape tools shown before the shape picker. */
const TOOLS_BEFORE: { id: Tool; label: string; icon: typeof Pencil }[] = [
  { id: "select", label: "Select (V)", icon: MousePointer2 },
  { id: "pan", label: "Pan (H / Space)", icon: Hand },
  { id: "pen", label: "Pen (P)", icon: Pencil },
];

/** Non-shape tools shown after the shape picker. */
const TOOLS_AFTER: { id: Tool; label: string; icon: typeof Pencil }[] = [
  { id: "arrow", label: "Arrow (A)", icon: ArrowUpRight },
  { id: "connector", label: "Connector (C)", icon: Spline },
  { id: "text", label: "Text (T)", icon: Type },
  { id: "sticky", label: "Sticky note (S)", icon: StickyNote },
  { id: "image", label: "Image", icon: ImageIcon },
];

/** Tools that are not box-based shapes (used to derive the shape picker value). */
const NON_SHAPE_TOOLS = new Set<Tool>([
  "select",
  "pan",
  "pen",
  "arrow",
  "connector",
  "text",
  "sticky",
  "image",
]);

const SWATCHES = [
  "#1f2937",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

const STROKES = [2, 4, 8];

const FILLS = ["#ffffff", "#fde68a", "#fecaca", "#bbf7d0", "#bfdbfe", "#e9d5ff"];

export function BoardToolbar({
  tool,
  onToolChange,
  color,
  onColorChange,
  fill,
  onFillChange,
  strokeWidth,
  onStrokeChange,
  selected,
  onUpdateSelected,
  hasSelection,
  onBringToFront,
  onSendToBack,
  onDelete,
  disabled,
}: {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  color: string;
  onColorChange: (color: string) => void;
  fill: string;
  onFillChange: (fill: string) => void;
  strokeWidth: number;
  onStrokeChange: (width: number) => void;
  selected: SceneElement | null;
  onUpdateSelected: (patch: Partial<SceneElement>) => void;
  hasSelection: boolean;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onDelete: () => void;
  disabled?: boolean;
}) {
  const isText = selected?.type === "text";
  const isImage = selected?.type === "image";
  const sep = <span className="mx-1 h-6 w-px bg-border" aria-hidden />;
  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-1 rounded-xl border border-border bg-popover/95 p-1 shadow-lg backdrop-blur">
      {TOOLS_BEFORE.map(({ id, label, icon: Icon }) => (
        <TipButton
          key={id}
          label={label}
          aria-pressed={tool === id}
          disabled={disabled}
          onClick={() => onToolChange(id)}
          className={cn(
            "flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40",
            tool === id && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
          )}
        >
          <Icon className="size-4" />
        </TipButton>
      ))}

      <ShapePicker
        value={NON_SHAPE_TOOLS.has(tool) ? null : (tool as ShapeKind)}
        onSelect={(shape) => onToolChange(shape)}
        disabled={disabled}
      />

      {TOOLS_AFTER.map(({ id, label, icon: Icon }) => (
        <TipButton
          key={id}
          label={label}
          aria-pressed={tool === id}
          disabled={disabled}
          onClick={() => onToolChange(id)}
          className={cn(
            "flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40",
            tool === id && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
          )}
        >
          <Icon className="size-4" />
        </TipButton>
      ))}

      <span className="mx-1 h-6 w-px bg-border" aria-hidden />

      <div className="flex items-center gap-0.5 px-0.5">
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            aria-label={`Color ${c}`}
            disabled={disabled}
            onClick={() => onColorChange(c)}
            className={cn(
              "size-6 rounded-full border transition-transform hover:scale-110 disabled:opacity-40",
              color === c ? "border-foreground ring-2 ring-primary/40" : "border-border"
            )}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      <span className="mx-1 h-6 w-px bg-border" aria-hidden />

      <div className="flex items-center gap-0.5">
        {STROKES.map((w) => (
          <button
            key={w}
            type="button"
            title={`Stroke ${w}px`}
            aria-label={`Stroke ${w}px`}
            aria-pressed={strokeWidth === w}
            disabled={disabled}
            onClick={() => onStrokeChange(w)}
            className={cn(
              "flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent disabled:opacity-40",
              strokeWidth === w && "bg-accent text-foreground"
            )}
          >
            <span
              className="rounded-full bg-current"
              style={{ width: Math.max(4, w + 2), height: Math.max(4, w + 2) }}
            />
          </button>
        ))}
      </div>

      <span className="mx-1 h-6 w-px bg-border" aria-hidden />

      <div className="flex items-center gap-0.5 px-0.5">
        <PaintBucket className="mr-0.5 size-3.5 text-muted-foreground" aria-hidden />
        <button
          type="button"
          title="No fill"
          aria-label="No fill"
          aria-pressed={fill === NO_FILL}
          disabled={disabled}
          onClick={() => onFillChange(NO_FILL)}
          className={cn(
            "flex size-6 items-center justify-center rounded-full border bg-background transition-transform hover:scale-110 disabled:opacity-40",
            fill === NO_FILL ? "border-foreground ring-2 ring-primary/40" : "border-border"
          )}
        >
          <Ban className="size-3.5 text-muted-foreground" />
        </button>
        {FILLS.map((c) => (
          <button
            key={c}
            type="button"
            title={`Fill ${c}`}
            aria-label={`Fill ${c}`}
            disabled={disabled}
            onClick={() => onFillChange(c)}
            className={cn(
              "size-6 rounded-full border transition-transform hover:scale-110 disabled:opacity-40",
              fill === c ? "border-foreground ring-2 ring-primary/40" : "border-border"
            )}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      {isText && (
        <>
          {sep}
          <TextFormatControls
            fontSize={selected.fontSize}
            fontWeight={selected.fontWeight}
            italic={selected.italic}
            underline={selected.underline}
            align={selected.align}
            link={selected.link ?? ""}
            listStyle={selected.listStyle ?? "none"}
            disabled={disabled}
            onChange={(patch) => onUpdateSelected(patch as Partial<SceneElement>)}
          />
        </>
      )}

      {isImage && (
        <>
          {sep}
          <CaptionField
            value={selected.caption ?? ""}
            disabled={disabled}
            onChange={(caption) => onUpdateSelected({ caption } as Partial<SceneElement>)}
          />
        </>
      )}

      {hasSelection && (
        <>
          <span className="mx-1 h-6 w-px bg-border" aria-hidden />
          <TipButton
            label="Bring to front"
            disabled={disabled}
            onClick={onBringToFront}
            className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
          >
            <BringToFront className="size-4" />
          </TipButton>
          <TipButton
            label="Send to back"
            disabled={disabled}
            onClick={onSendToBack}
            className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
          >
            <SendToBack className="size-4" />
          </TipButton>
          <TipButton
            label="Delete (Del)"
            disabled={disabled}
            onClick={onDelete}
            className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
          >
            <Trash2 className="size-4" />
          </TipButton>
        </>
      )}
    </div>
  );
}
