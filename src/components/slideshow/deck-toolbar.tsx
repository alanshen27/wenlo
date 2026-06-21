"use client";

import type { ComponentProps } from "react";
import {
  ArrowUpRight,
  Ban,
  BringToFront,
  Copy,
  Image as ImageIcon,
  MousePointer2,
  Play,
  SendToBack,
  Spline,
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
import type { DeckElement } from "@/lib/decks/deck-schema";

const NO_FILL = "transparent";

/** Drawing tools for the deck canvas. */
export type DeckTool = "select" | "text" | "arrow" | "connector" | ShapeKind;

const NON_SHAPE_TOOLS = new Set<DeckTool>(["select", "text", "arrow", "connector"]);

const activeTool =
  "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary";

const TEXT_SWATCHES = [
  "#1f2937",
  "#ffffff",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
];

const FILL_SWATCHES = [
  "#ffffff",
  "#1f2937",
  "#fde68a",
  "#fecaca",
  "#bbf7d0",
  "#bfdbfe",
  "#e9d5ff",
];

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

const iconBtn =
  "flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40";

export function DeckToolbar({
  selected,
  disabled,
  tool,
  onToolChange,
  onAddImage,
  onUpdate,
  onBringToFront,
  onSendToBack,
  onDuplicate,
  onDelete,
  onPresent,
}: {
  selected: DeckElement | null;
  disabled?: boolean;
  tool: DeckTool;
  onToolChange: (tool: DeckTool) => void;
  onAddImage: () => void;
  onUpdate: (patch: Partial<DeckElement>) => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onPresent: () => void;
}) {
  const isText = selected?.type === "text";
  const isShape = selected?.type === "shape";
  const isImage = selected?.type === "image";
  const isStroke =
    selected?.type === "arrow" ||
    selected?.type === "connector" ||
    (selected?.type === "shape" && selected.shape === "line");
  const sep = <span className="mx-1 h-6 w-px bg-border" aria-hidden />;

  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-1 rounded-xl border border-border bg-popover/95 p-1 shadow-lg backdrop-blur">
      <TipButton
        label="Select (V)"
        disabled={disabled}
        aria-pressed={tool === "select"}
        onClick={() => onToolChange("select")}
        className={cn(iconBtn, tool === "select" && activeTool)}
      >
        <MousePointer2 className="size-4" />
      </TipButton>
      <TipButton
        label="Text — click or drag"
        disabled={disabled}
        aria-pressed={tool === "text"}
        onClick={() => onToolChange("text")}
        className={cn(iconBtn, tool === "text" && activeTool)}
      >
        <Type className="size-4" />
      </TipButton>
      <ShapePicker
        value={NON_SHAPE_TOOLS.has(tool) ? null : (tool as ShapeKind)}
        onSelect={(shape) => onToolChange(shape)}
        disabled={disabled}
      />
      <TipButton
        label="Arrow (A)"
        disabled={disabled}
        aria-pressed={tool === "arrow"}
        onClick={() => onToolChange("arrow")}
        className={cn(iconBtn, tool === "arrow" && activeTool)}
      >
        <ArrowUpRight className="size-4" />
      </TipButton>
      <TipButton
        label="Connector (C)"
        disabled={disabled}
        aria-pressed={tool === "connector"}
        onClick={() => onToolChange("connector")}
        className={cn(iconBtn, tool === "connector" && activeTool)}
      >
        <Spline className="size-4" />
      </TipButton>
      <TipButton label="Add image" disabled={disabled} onClick={onAddImage} className={iconBtn}>
        <ImageIcon className="size-4" />
      </TipButton>

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
            onChange={(patch) => onUpdate(patch as Partial<DeckElement>)}
          />
        </>
      )}

      {isImage && (
        <>
          {sep}
          <CaptionField
            value={selected.caption ?? ""}
            disabled={disabled}
            onChange={(caption) => onUpdate({ caption } as Partial<DeckElement>)}
          />
        </>
      )}

      {(isText || isShape || isStroke) && (
        <>
          {sep}
          <span className="px-0.5 text-[10px] font-medium uppercase text-muted-foreground">
            {isText ? "Color" : "Line"}
          </span>
          {TEXT_SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              aria-label={`Color ${c}`}
              disabled={disabled}
              onClick={() => {
                if (isText) onUpdate({ color: c } as Partial<DeckElement>);
                else if (isShape) onUpdate({ stroke: c } as Partial<DeckElement>);
                else if (selected?.type === "arrow" || selected?.type === "connector")
                  onUpdate({ stroke: c } as Partial<DeckElement>);
              }}
              className="size-6 rounded-full border border-border transition-transform hover:scale-110 disabled:opacity-40"
              style={{ backgroundColor: c }}
            />
          ))}
        </>
      )}

      {isShape && (
        <>
          {sep}
          <span className="px-0.5 text-[10px] font-medium uppercase text-muted-foreground">Fill</span>
          <button
            type="button"
            title="No fill"
            aria-label="No fill"
            disabled={disabled}
            onClick={() => onUpdate({ fill: NO_FILL } as Partial<DeckElement>)}
            className="flex size-6 items-center justify-center rounded-full border border-border bg-background transition-transform hover:scale-110 disabled:opacity-40"
          >
            <Ban className="size-3.5 text-muted-foreground" />
          </button>
          {FILL_SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              aria-label={`Fill ${c}`}
              disabled={disabled}
              onClick={() => onUpdate({ fill: c } as Partial<DeckElement>)}
              className="size-6 rounded-full border border-border transition-transform hover:scale-110 disabled:opacity-40"
              style={{ backgroundColor: c }}
            />
          ))}
        </>
      )}

      {selected && (
        <>
          {sep}
          <TipButton label="Bring to front" disabled={disabled} onClick={onBringToFront} className={iconBtn}>
            <BringToFront className="size-4" />
          </TipButton>
          <TipButton label="Send to back" disabled={disabled} onClick={onSendToBack} className={iconBtn}>
            <SendToBack className="size-4" />
          </TipButton>
          <TipButton label="Duplicate" disabled={disabled} onClick={onDuplicate} className={iconBtn}>
            <Copy className="size-4" />
          </TipButton>
          <TipButton
            label="Delete"
            disabled={disabled}
            onClick={onDelete}
            className={cn(iconBtn, "hover:bg-destructive/10 hover:text-destructive")}
          >
            <Trash2 className="size-4" />
          </TipButton>
        </>
      )}

      {sep}
      <TipButton label="Present (from start)" onClick={onPresent} className={iconBtn}>
        <Play className="size-4" />
      </TipButton>
    </div>
  );
}
