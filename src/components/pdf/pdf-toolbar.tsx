"use client";

import type { ComponentProps } from "react";
import { Eraser, Highlighter, MousePointer2, Pencil, StickyNote, Trash2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/blocknote-ui/tooltip";
import {
  PDF_HIGHLIGHT_SWATCHES,
  PDF_HIGHLIGHT_WIDTHS,
  PDF_INK_SWATCHES,
  PDF_INK_WIDTHS,
  PDF_NOTE_SWATCHES,
} from "@/lib/pdfs/pdf-annotation-schema";
import { cn } from "@/lib/core/utils";

export type PdfTool = "select" | "pen" | "highlight" | "note" | "eraser";

export type PdfSelectionKind = "ink" | "highlight" | "note" | null;

const TOOLS: { id: PdfTool; label: string; icon: typeof Pencil }[] = [
  { id: "select", label: "Select (V)", icon: MousePointer2 },
  { id: "pen", label: "Pen (P)", icon: Pencil },
  { id: "highlight", label: "Highlight (H)", icon: Highlighter },
  { id: "note", label: "Note (N)", icon: StickyNote },
  { id: "eraser", label: "Eraser (E)", icon: Eraser },
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

function swatchesForTool(tool: PdfTool, selectionKind: PdfSelectionKind) {
  const kind =
    tool === "select"
      ? selectionKind
      : tool === "pen"
        ? "ink"
        : tool === "highlight"
          ? "highlight"
          : tool === "note"
            ? "note"
            : null;
  if (kind === "ink") return PDF_INK_SWATCHES;
  if (kind === "highlight") return PDF_HIGHLIGHT_SWATCHES;
  if (kind === "note") return PDF_NOTE_SWATCHES;
  return null;
}

function widthsForTool(tool: PdfTool, selectionKind: PdfSelectionKind) {
  const kind =
    tool === "select"
      ? selectionKind
      : tool === "pen"
        ? "ink"
        : tool === "highlight"
          ? "highlight"
          : null;
  if (kind === "ink") return PDF_INK_WIDTHS;
  if (kind === "highlight") return PDF_HIGHLIGHT_WIDTHS;
  return null;
}

/** Map normalized width to a visible dot size in the toolbar. */
function widthDotSize(normalized: number, kind: "ink" | "highlight"): number {
  const scale = kind === "ink" ? 900 : 220;
  return Math.max(4, Math.min(14, normalized * scale));
}

export function PdfToolbar({
  tool,
  onToolChange,
  color,
  onColorChange,
  strokeWidth,
  onStrokeWidthChange,
  selectionKind,
  hasSelection,
  onDelete,
  disabled,
}: {
  tool: PdfTool;
  onToolChange: (tool: PdfTool) => void;
  color: string;
  onColorChange: (color: string) => void;
  strokeWidth: number;
  onStrokeWidthChange: (width: number) => void;
  selectionKind?: PdfSelectionKind;
  hasSelection: boolean;
  onDelete: () => void;
  disabled?: boolean;
}) {
  const swatches = swatchesForTool(tool, selectionKind ?? null);
  const widths = widthsForTool(tool, selectionKind ?? null);
  const widthKind =
    tool === "pen" || (tool === "select" && selectionKind === "ink")
      ? "ink"
      : tool === "highlight" || (tool === "select" && selectionKind === "highlight")
        ? "highlight"
        : null;

  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-1 rounded-xl border border-border bg-popover/95 p-1 shadow-lg backdrop-blur">
      {TOOLS.map(({ id, label, icon: Icon }) => (
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

      {swatches && (
        <>
          <span className="mx-1 h-6 w-px bg-border" aria-hidden />
          <div className="flex items-center gap-0.5 px-0.5">
            {swatches.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                aria-label={`Color ${c}`}
                aria-pressed={color === c}
                disabled={disabled}
                onClick={() => onColorChange(c)}
                className={cn(
                  "size-6 rounded-full border transition-transform hover:scale-110 disabled:opacity-40",
                  (tool === "highlight" || selectionKind === "highlight") && "rounded-sm",
                  color === c ? "border-foreground ring-2 ring-primary/40" : "border-border"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </>
      )}

      {widths && widthKind && (
        <>
          <span className="mx-1 h-6 w-px bg-border" aria-hidden />
          <div className="flex items-center gap-0.5">
            {widths.map((w) => (
              <button
                key={w}
                type="button"
                title={`Width ${w}`}
                aria-label={`Stroke width ${w}`}
                aria-pressed={strokeWidth === w}
                disabled={disabled}
                onClick={() => onStrokeWidthChange(w)}
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent disabled:opacity-40",
                  strokeWidth === w && "bg-accent text-foreground"
                )}
              >
                <span
                  className="rounded-full bg-current"
                  style={{
                    width: widthDotSize(w, widthKind),
                    height: widthDotSize(w, widthKind),
                  }}
                />
              </button>
            ))}
          </div>
        </>
      )}

      {hasSelection && tool === "select" && (
        <>
          <span className="mx-1 h-6 w-px bg-border" aria-hidden />
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
