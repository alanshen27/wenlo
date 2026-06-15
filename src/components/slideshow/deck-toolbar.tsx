"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Ban,
  Bold,
  BringToFront,
  Copy,
  Image as ImageIcon,
  Italic,
  MousePointer2,
  Play,
  SendToBack,
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
import type { ShapeKind } from "@/lib/canvas/shapes";
import type { DeckElement, TextAlign } from "@/lib/decks/deck-schema";

const NO_FILL = "transparent";

/** Drawing tools for the deck canvas. `select` is the default; `text` and any
 *  shape are drag-to-create (a plain click falls back to a default size).
 *  Images are added through a one-shot file picker, so they are not tools. */
export type DeckTool = "select" | "text" | ShapeKind;

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

const MIN_FONT = 4;
const MAX_FONT = 400;

/** Free-entry font-size field. Mirrors the selected element's *actual* size
 *  (rounded), so a transformer-resized text always shows its true size instead
 *  of snapping to a fixed preset. Presets are offered via a datalist. */
function FontSizeField({
  value,
  disabled,
  onChange,
}: {
  value: number;
  disabled?: boolean;
  onChange: (size: number) => void;
}) {
  const rounded = Math.round(value);
  const [text, setText] = useState(String(rounded));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(String(rounded));
  }, [rounded]);

  return (
    <input
      type="number"
      inputMode="numeric"
      aria-label="Font size"
      title="Font size"
      min={MIN_FONT}
      max={MAX_FONT}
      disabled={disabled}
      value={text}
      onFocus={(e) => {
        focused.current = true;
        e.currentTarget.select();
      }}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        if (Number.isFinite(n) && n >= 1) {
          onChange(Math.min(MAX_FONT, Math.round(n)));
        }
      }}
      onBlur={() => {
        focused.current = false;
        const n = Math.round(Number(text));
        const clamped = Math.max(MIN_FONT, Math.min(MAX_FONT, Number.isFinite(n) && n > 0 ? n : rounded));
        onChange(clamped);
        setText(String(clamped));
      }}
      className="h-9 w-12 rounded-lg border border-border bg-background text-center text-sm tabular-nums outline-none focus:border-primary disabled:opacity-40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    />
  );
}

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
        value={tool === "select" || tool === "text" ? null : tool}
        onSelect={(shape) => onToolChange(shape)}
        disabled={disabled}
      />
      <TipButton label="Add image" disabled={disabled} onClick={onAddImage} className={iconBtn}>
        <ImageIcon className="size-4" />
      </TipButton>

      {isText && (
        <>
          {sep}
          <FontSizeField
            value={selected.type === "text" ? selected.fontSize : 24}
            disabled={disabled}
            onChange={(size) => onUpdate({ fontSize: size } as Partial<DeckElement>)}
          />
          <TipButton
            label="Bold"
            disabled={disabled}
            aria-pressed={selected.type === "text" && (selected.fontWeight ?? 400) >= 600}
            onClick={() =>
              onUpdate({
                fontWeight:
                  selected.type === "text" && (selected.fontWeight ?? 400) >= 600 ? 400 : 700,
              } as Partial<DeckElement>)
            }
            className={cn(
              iconBtn,
              selected.type === "text" && (selected.fontWeight ?? 400) >= 600 && "bg-accent text-foreground"
            )}
          >
            <Bold className="size-4" />
          </TipButton>
          <TipButton
            label="Italic"
            disabled={disabled}
            aria-pressed={selected.type === "text" && Boolean(selected.italic)}
            onClick={() =>
              onUpdate({ italic: !(selected.type === "text" && selected.italic) } as Partial<DeckElement>)
            }
            className={cn(
              iconBtn,
              selected.type === "text" && selected.italic && "bg-accent text-foreground"
            )}
          >
            <Italic className="size-4" />
          </TipButton>
          {(["left", "center", "right"] as TextAlign[]).map((a) => {
            const Icon = a === "left" ? AlignLeft : a === "center" ? AlignCenter : AlignRight;
            return (
              <TipButton
                key={a}
                label={`Align ${a}`}
                disabled={disabled}
                aria-pressed={selected.type === "text" && (selected.align ?? "left") === a}
                onClick={() => onUpdate({ align: a } as Partial<DeckElement>)}
                className={cn(
                  iconBtn,
                  selected.type === "text" && (selected.align ?? "left") === a && "bg-accent text-foreground"
                )}
              >
                <Icon className="size-4" />
              </TipButton>
            );
          })}
        </>
      )}

      {(isText || isShape) && (
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
              onClick={() =>
                onUpdate((isText ? { color: c } : { stroke: c }) as Partial<DeckElement>)
              }
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
