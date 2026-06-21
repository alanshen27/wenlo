"use client";

import { useState } from "react";
import { Plus, Trash2, Type, Hash, ChevronDown, CalendarDays, CheckSquare, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CellEditor, nextOptionColor } from "@/components/database/cell-editors";
import type { DatabaseController } from "@/components/database/use-database";
import {
  newLocalId,
  PROPERTY_TYPE_LABELS,
  type DatabaseProperty,
  type PropertyType,
} from "@/lib/databases/database-schema";
import { cn } from "@/lib/core/utils";

const TYPE_ICONS: Record<PropertyType, typeof Type> = {
  TEXT: Type,
  NUMBER: Hash,
  SELECT: List,
  DATE: CalendarDays,
  CHECKBOX: CheckSquare,
};

const ALL_TYPES: PropertyType[] = ["TEXT", "NUMBER", "SELECT", "DATE", "CHECKBOX"];

function columnWidth(prop: DatabaseProperty, isPrimary: boolean): number {
  return prop.width ?? (isPrimary ? 260 : 176);
}

export function DatabaseTable({ controller }: { controller: DatabaseController }) {
  const { scene, readOnly } = controller;
  if (!scene) return null;

  function createOption(rowId: string, property: DatabaseProperty, label: string) {
    const option = { id: newLocalId(), label, color: nextOptionColor(property.options) };
    void controller.updateProperty(property.id, { options: [...property.options, option] });
    controller.setCell(rowId, property.id, option.id);
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="inline-block min-w-full align-top">
        {/* Header */}
        <div className="sticky top-0 z-10 flex border-b border-border bg-background">
          {scene.properties.map((property, index) => (
            <PropertyHeader
              key={property.id}
              property={property}
              isPrimary={index === 0}
              readOnly={readOnly}
              controller={controller}
            />
          ))}
          {!readOnly && <AddColumnButton controller={controller} />}
        </div>

        {/* Rows */}
        {scene.rows.map((row) => (
          <div key={row.id} className="group/row flex border-b border-border/60 hover:bg-muted/30">
            {scene.properties.map((property, index) => (
              <div
                key={property.id}
                className="shrink-0 border-r border-border/40"
                style={{ width: columnWidth(property, index === 0) }}
              >
                <CellEditor
                  property={property}
                  value={row.cells[property.id] ?? null}
                  readOnly={readOnly}
                  onChange={(value) => controller.setCell(row.id, property.id, value)}
                  onCreateOption={(label) => createOption(row.id, property, label)}
                />
              </div>
            ))}
            {!readOnly && (
              <div className="flex w-10 items-center justify-center">
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="opacity-0 group-hover/row:opacity-100"
                  aria-label="Delete row"
                  onClick={() => controller.deleteRow(row.id)}
                >
                  <Trash2 className="size-3.5 text-muted-foreground" />
                </Button>
              </div>
            )}
          </div>
        ))}

        {/* New row */}
        {!readOnly && (
          <button
            type="button"
            onClick={() => controller.addRow()}
            className="flex w-full items-center gap-1.5 px-2 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <Plus className="size-4" />
            New row
          </button>
        )}

        {scene.rows.length === 0 && readOnly && (
          <div className="px-2 py-6 text-sm text-muted-foreground">No rows yet.</div>
        )}
      </div>
    </div>
  );
}

function PropertyHeader({
  property,
  isPrimary,
  readOnly,
  controller,
}: {
  property: DatabaseProperty;
  isPrimary: boolean;
  readOnly: boolean;
  controller: DatabaseController;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(property.name);
  const Icon = TYPE_ICONS[property.type];

  if (readOnly) {
    return (
      <div
        className="flex shrink-0 items-center gap-1.5 border-r border-border/40 px-2 py-2 text-xs font-medium text-muted-foreground"
        style={{ width: columnWidth(property, isPrimary) }}
      >
        <Icon className="size-3.5" />
        <span className="truncate">{property.name}</span>
      </div>
    );
  }

  return (
    <div
      className="shrink-0 border-r border-border/40"
      style={{ width: columnWidth(property, isPrimary) }}
    >
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next && name.trim() && name !== property.name) {
            controller.updateProperty(property.id, { name: name.trim() });
          }
        }}
      >
        <PopoverTrigger className="flex w-full items-center gap-1.5 px-2 py-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground">
          <Icon className="size-3.5 shrink-0" />
          <span className="flex-1 truncate">{property.name}</span>
          <ChevronDown className="size-3 opacity-50" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (name.trim()) controller.updateProperty(property.id, { name: name.trim() });
                setOpen(false);
              }
            }}
            placeholder="Property name"
            className="mb-2 w-full rounded-md border border-border bg-transparent px-2 py-1 text-sm outline-none focus:border-ring"
          />
          <p className="px-1 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
            Type
          </p>
          <div className="grid grid-cols-1 gap-0.5">
            {ALL_TYPES.map((type) => {
              const TIcon = TYPE_ICONS[type];
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    if (type !== property.type) controller.updateProperty(property.id, { type });
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-muted",
                    type === property.type && "bg-muted"
                  )}
                >
                  <TIcon className="size-3.5 text-muted-foreground" />
                  {PROPERTY_TYPE_LABELS[type]}
                </button>
              );
            })}
          </div>
          {!isPrimary && (
            <>
              <div className="my-1 h-px bg-border" />
              <button
                type="button"
                onClick={() => {
                  controller.deleteProperty(property.id);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-3.5" />
                Delete property
              </button>
            </>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function AddColumnButton({ controller }: { controller: DatabaseController }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" className="m-1 shrink-0" aria-label="Add column" />
        }
      >
        <Plus className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40">
        {ALL_TYPES.map((type) => {
          const TIcon = TYPE_ICONS[type];
          return (
            <DropdownMenuItem key={type} onClick={() => controller.addProperty(type)}>
              <TIcon className="size-3.5" />
              {PROPERTY_TYPE_LABELS[type]}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
