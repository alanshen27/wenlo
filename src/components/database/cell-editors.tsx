"use client";

import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  selectColorClasses,
  SELECT_COLORS,
  type CellValue,
  type DatabaseProperty,
  type SelectColor,
  type SelectOption,
} from "@/lib/databases/database-schema";
import { cn } from "@/lib/core/utils";

export function OptionPill({
  option,
  className,
}: {
  option: SelectOption;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-xs font-medium",
        selectColorClasses(option.color),
        className
      )}
    >
      {option.label}
    </span>
  );
}

/** Read-only render of a cell value (used on cards). */
export function CellDisplay({
  property,
  value,
}: {
  property: DatabaseProperty;
  value: CellValue;
}) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground/50">—</span>;
  }
  switch (property.type) {
    case "SELECT": {
      const option = property.options.find((o) => o.id === value);
      return option ? <OptionPill option={option} /> : <span className="text-muted-foreground/50">—</span>;
    }
    case "CHECKBOX":
      return value ? <Check className="size-4 text-emerald-600" /> : <span className="text-muted-foreground/50">—</span>;
    case "DATE":
      return <span className="text-xs">{formatDate(String(value))}</span>;
    default:
      return <span className="truncate">{String(value)}</span>;
  }
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

type CellProps = {
  property: DatabaseProperty;
  value: CellValue;
  readOnly?: boolean;
  onChange: (value: CellValue) => void;
  /** SELECT only: create a new option and assign it. */
  onCreateOption?: (label: string) => void;
};

/** Inline editor for a single cell, dispatched by property type. */
export function CellEditor(props: CellProps) {
  switch (props.property.type) {
    case "NUMBER":
      return <NumberCell {...props} />;
    case "CHECKBOX":
      return <CheckboxCell {...props} />;
    case "DATE":
      return <DateCell {...props} />;
    case "SELECT":
      return <SelectCell {...props} />;
    default:
      return <TextCell {...props} />;
  }
}

function TextCell({ value, readOnly, onChange }: CellProps) {
  return (
    <input
      type="text"
      value={value == null ? "" : String(value)}
      readOnly={readOnly}
      onChange={(e) => onChange(e.target.value)}
      className="h-full w-full bg-transparent px-2 py-1 text-sm outline-none read-only:cursor-default"
    />
  );
}

function NumberCell({ value, readOnly, onChange }: CellProps) {
  return (
    <input
      type="number"
      value={value == null ? "" : String(value)}
      readOnly={readOnly}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      className="h-full w-full bg-transparent px-2 py-1 text-sm tabular-nums outline-none read-only:cursor-default"
    />
  );
}

function DateCell({ value, readOnly, onChange }: CellProps) {
  return (
    <input
      type="date"
      value={typeof value === "string" ? value : ""}
      readOnly={readOnly}
      onChange={(e) => onChange(e.target.value || null)}
      className="h-full w-full bg-transparent px-2 py-1 text-sm outline-none read-only:cursor-default"
    />
  );
}

function CheckboxCell({ value, readOnly, onChange }: CellProps) {
  const checked = Boolean(value);
  return (
    <div className="flex h-full w-full items-center px-2">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={readOnly}
        onClick={() => onChange(!checked)}
        className={cn(
          "flex size-4 items-center justify-center rounded border transition-colors",
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/40 hover:border-muted-foreground"
        )}
      >
        {checked && <Check className="size-3" strokeWidth={3} />}
      </button>
    </div>
  );
}

function SelectCell({ property, value, readOnly, onChange, onCreateOption }: CellProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = property.options.find((o) => o.id === value);

  const filtered = property.options.filter((o) =>
    o.label.toLowerCase().includes(query.trim().toLowerCase())
  );
  const exact = property.options.some(
    (o) => o.label.toLowerCase() === query.trim().toLowerCase()
  );

  return (
    <Popover open={open} onOpenChange={readOnly ? undefined : setOpen}>
      <PopoverTrigger
        disabled={readOnly}
        className="flex h-full w-full items-center px-2 py-1 text-left outline-none disabled:cursor-default"
      >
        {selected ? (
          <OptionPill option={selected} />
        ) : (
          <span className="text-sm text-muted-foreground/40">Empty</span>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1.5">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && query.trim() && !exact && onCreateOption) {
              onCreateOption(query.trim());
              setQuery("");
              setOpen(false);
            }
          }}
          placeholder="Search or create…"
          className="mb-1 w-full rounded-md border border-border bg-transparent px-2 py-1 text-sm outline-none focus:border-ring"
        />
        <div className="max-h-56 overflow-y-auto">
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted"
            >
              <X className="size-3.5" />
              Clear
            </button>
          )}
          {filtered.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                onChange(option.id);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left hover:bg-muted"
            >
              <OptionPill option={option} />
              {option.id === value && <Check className="size-3.5 text-muted-foreground" />}
            </button>
          ))}
          {query.trim() && !exact && onCreateOption && (
            <button
              type="button"
              onClick={() => {
                onCreateOption(query.trim());
                setQuery("");
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-muted"
            >
              <Plus className="size-3.5 text-muted-foreground" />
              Create <OptionPill option={{ id: "_new", label: query.trim(), color: "gray" }} />
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Pick a color for a brand-new select option, cycling through the palette. */
export function nextOptionColor(existing: SelectOption[]): SelectColor {
  return SELECT_COLORS[existing.length % SELECT_COLORS.length];
}
