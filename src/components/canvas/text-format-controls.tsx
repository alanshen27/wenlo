"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, Link2, List, Underline } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/blocknote-ui/tooltip";
import { cn } from "@/lib/core/utils";
import type { TextAlign, TextListStyle } from "@/lib/scene/elements";

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

export function FontSizeField({
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

export type TextFormatPatch = {
  fontSize?: number;
  fontWeight?: number;
  italic?: boolean;
  underline?: boolean;
  align?: TextAlign;
  link?: string;
  color?: string;
  listStyle?: TextListStyle;
};

export function TextFormatControls({
  fontSize,
  fontWeight = 400,
  italic = false,
  underline = false,
  align = "left",
  link = "",
  listStyle = "none",
  disabled,
  onChange,
  showFontSize = true,
  showLink = true,
}: {
  fontSize: number;
  fontWeight?: number;
  italic?: boolean;
  underline?: boolean;
  align?: TextAlign;
  link?: string;
  listStyle?: TextListStyle;
  disabled?: boolean;
  onChange: (patch: TextFormatPatch) => void;
  showFontSize?: boolean;
  showLink?: boolean;
}) {
  const [linkDraft, setLinkDraft] = useState(link);
  const linkFocused = useRef(false);

  useEffect(() => {
    if (!linkFocused.current) setLinkDraft(link);
  }, [link]);

  return (
    <>
      {showFontSize && (
        <FontSizeField
          value={fontSize}
          disabled={disabled}
          onChange={(size) => onChange({ fontSize: size })}
        />
      )}
      <TipButton
        label="Bold"
        disabled={disabled}
        aria-pressed={fontWeight >= 600}
        onClick={() => onChange({ fontWeight: fontWeight >= 600 ? 400 : 700 })}
        className={cn(iconBtn, fontWeight >= 600 && "bg-accent text-foreground")}
      >
        <Bold className="size-4" />
      </TipButton>
      <TipButton
        label="Italic"
        disabled={disabled}
        aria-pressed={italic}
        onClick={() => onChange({ italic: !italic })}
        className={cn(iconBtn, italic && "bg-accent text-foreground")}
      >
        <Italic className="size-4" />
      </TipButton>
      <TipButton
        label="Underline"
        disabled={disabled}
        aria-pressed={underline}
        onClick={() => onChange({ underline: !underline })}
        className={cn(iconBtn, underline && "bg-accent text-foreground")}
      >
        <Underline className="size-4" />
      </TipButton>
      <TipButton
        label="Bulleted list"
        disabled={disabled}
        aria-pressed={listStyle === "bullet"}
        onClick={() => onChange({ listStyle: listStyle === "bullet" ? "none" : "bullet" })}
        className={cn(iconBtn, listStyle === "bullet" && "bg-accent text-foreground")}
      >
        <List className="size-4" />
      </TipButton>
      {(["left", "center", "right"] as TextAlign[]).map((a) => {
        const Icon = a === "left" ? AlignLeft : a === "center" ? AlignCenter : AlignRight;
        return (
          <TipButton
            key={a}
            label={`Align ${a}`}
            disabled={disabled}
            aria-pressed={align === a}
            onClick={() => onChange({ align: a })}
            className={cn(iconBtn, align === a && "bg-accent text-foreground")}
          >
            <Icon className="size-4" />
          </TipButton>
        );
      })}
      {showLink && (
        <div className="flex items-center gap-1">
          <Link2 className="size-3.5 text-muted-foreground" aria-hidden />
          <input
            type="url"
            placeholder="https://"
            aria-label="Link URL"
            disabled={disabled}
            value={linkDraft}
            onFocus={() => {
              linkFocused.current = true;
            }}
            onChange={(e) => setLinkDraft(e.target.value)}
            onBlur={() => {
              linkFocused.current = false;
              onChange({ link: linkDraft.trim() });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="h-9 w-36 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-primary disabled:opacity-40"
          />
        </div>
      )}
    </>
  );
}

export function CaptionField({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  onChange: (caption: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);

  return (
    <input
      type="text"
      placeholder="Caption"
      aria-label="Image caption"
      disabled={disabled}
      value={draft}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        focused.current = false;
        onChange(draft.trim());
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="h-9 w-40 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-primary disabled:opacity-40"
    />
  );
}
