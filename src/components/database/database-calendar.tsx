"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DatabaseController } from "@/components/database/use-database";
import {
  primaryProperty,
  type DatabaseRowData,
  type DatabaseScene,
  type DatabaseView,
} from "@/lib/databases/database-schema";
import { cn } from "@/lib/core/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function isoOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}
function todayIso(): string {
  return isoOf(new Date());
}

export function DatabaseCalendar({
  controller,
  view,
}: {
  controller: DatabaseController;
  view: DatabaseView;
}) {
  const { scene, readOnly } = controller;
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() };
  });
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const dateProperty = scene?.properties.find(
    (p) => p.id === view.config.datePropertyId && p.type === "DATE"
  );

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(cursor.year, cursor.month, 1));
    const startWeekday = first.getUTCDay();
    const daysInMonth = new Date(Date.UTC(cursor.year, cursor.month + 1, 0)).getUTCDate();
    const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
    const gridStart = new Date(first);
    gridStart.setUTCDate(first.getUTCDate() - startWeekday);

    return Array.from({ length: totalCells }, (_, i) => {
      const date = new Date(gridStart);
      date.setUTCDate(gridStart.getUTCDate() + i);
      return {
        iso: isoOf(date),
        day: date.getUTCDate(),
        inMonth: date.getUTCMonth() === cursor.month,
      };
    });
  }, [cursor]);

  const { byDate, unscheduled } = useMemo(() => {
    const map = new Map<string, DatabaseRowData[]>();
    const none: DatabaseRowData[] = [];
    if (scene && dateProperty) {
      for (const row of scene.rows) {
        const value = row.cells[dateProperty.id];
        if (typeof value === "string" && value) {
          if (!map.has(value)) map.set(value, []);
          map.get(value)!.push(row);
        } else {
          none.push(row);
        }
      }
    }
    return { byDate: map, unscheduled: none };
  }, [scene, dateProperty]);

  if (!scene) return null;

  if (!dateProperty) {
    return <DatePicker scene={scene} view={view} controller={controller} readOnly={readOnly} />;
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveRowId(null);
    const rowId = String(event.active.id);
    const over = event.over?.id;
    if (!over || !dateProperty) return;
    const target = String(over);
    if (target === "unscheduled") {
      controller.setCell(rowId, dateProperty.id, null);
    } else if (target.startsWith("day:")) {
      controller.setCell(rowId, dateProperty.id, target.slice(4));
    }
  }

  const primary = primaryProperty(scene.properties);
  const activeRow = activeRowId ? scene.rows.find((r) => r.id === activeRowId) : null;
  const monthLabel = new Date(Date.UTC(cursor.year, cursor.month, 1)).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
        <div className="flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Previous month"
            onClick={() =>
              setCursor((c) => {
                const m = c.month - 1;
                return m < 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: m };
              })
            }
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-36 text-center text-sm font-medium">{monthLabel}</span>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Next month"
            onClick={() =>
              setCursor((c) => {
                const m = c.month + 1;
                return m > 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: m };
              })
            }
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => {
              const now = new Date();
              setCursor({ year: now.getUTCFullYear(), month: now.getUTCMonth() });
            }}
          >
            Today
          </Button>
        </div>
        <div className="ml-auto">
          <DatePicker scene={scene} view={view} controller={controller} readOnly={readOnly} compact />
        </div>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={(e: DragStartEvent) => setActiveRowId(String(e.active.id))}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveRowId(null)}
      >
        <div className="flex flex-1 gap-3 overflow-hidden p-4">
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="grid grid-cols-7 border-b border-border pb-1 text-xs font-medium text-muted-foreground">
              {WEEKDAYS.map((d) => (
                <div key={d} className="px-2">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid flex-1 auto-rows-fr grid-cols-7 overflow-y-auto">
              {cells.map((cell) => (
                <DayCell
                  key={cell.iso}
                  iso={cell.iso}
                  day={cell.day}
                  inMonth={cell.inMonth}
                  isToday={cell.iso === todayIso()}
                  rows={byDate.get(cell.iso) ?? []}
                  primaryId={primary?.id ?? null}
                  readOnly={readOnly}
                  onAdd={() => controller.addRow({ [dateProperty.id]: cell.iso })}
                />
              ))}
            </div>
          </div>

          <UnscheduledTray rows={unscheduled} primaryId={primary?.id ?? null} />
        </div>

        <DragOverlay>
          {activeRow && primary ? (
            <Chip label={chipLabel(activeRow, primary.id)} dragging />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function chipLabel(row: DatabaseRowData, primaryId: string | null): string {
  const v = primaryId ? row.cells[primaryId] : null;
  return v ? String(v) : "Untitled";
}

function DayCell({
  iso,
  day,
  inMonth,
  isToday,
  rows,
  primaryId,
  readOnly,
  onAdd,
}: {
  iso: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  rows: DatabaseRowData[];
  primaryId: string | null;
  readOnly: boolean;
  onAdd: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${iso}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group/day min-h-24 border-b border-r border-border/50 p-1",
        !inMonth && "bg-muted/30 text-muted-foreground/50",
        isOver && "bg-primary/5"
      )}
    >
      <div className="mb-1 flex items-center justify-between px-1">
        <span
          className={cn(
            "text-xs",
            isToday &&
              "flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
          )}
        >
          {day}
        </span>
        {!readOnly && (
          <button
            type="button"
            onClick={onAdd}
            aria-label="Add row"
            className="opacity-0 transition-opacity group-hover/day:opacity-100"
          >
            <Plus className="size-3.5 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>
      <div className="flex flex-col gap-1">
        {rows.map((row) => (
          <DraggableChip
            key={row.id}
            rowId={row.id}
            label={chipLabel(row, primaryId)}
            readOnly={readOnly}
          />
        ))}
      </div>
    </div>
  );
}

function UnscheduledTray({
  rows,
  primaryId,
}: {
  rows: DatabaseRowData[];
  primaryId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "unscheduled" });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-56 shrink-0 flex-col overflow-y-auto rounded-lg border border-border p-2",
        isOver && "border-primary/40 bg-primary/5"
      )}
    >
      <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">
        Unscheduled {rows.length > 0 && `(${rows.length})`}
      </p>
      <div className="flex flex-col gap-1">
        {rows.map((row) => (
          <DraggableChip key={row.id} rowId={row.id} label={chipLabel(row, primaryId)} />
        ))}
        {rows.length === 0 && (
          <p className="px-1 text-xs text-muted-foreground/60">Drag here to clear a date.</p>
        )}
      </div>
    </div>
  );
}

function DraggableChip({
  rowId,
  label,
  readOnly,
}: {
  rowId: string;
  label: string;
  readOnly?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: rowId,
    disabled: readOnly,
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(isDragging && "opacity-40")}
    >
      <Chip label={label} />
    </div>
  );
}

function Chip({ label, dragging }: { label: string; dragging?: boolean }) {
  return (
    <div
      className={cn(
        "cursor-grab truncate rounded-md border border-border bg-card px-2 py-1 text-xs active:cursor-grabbing",
        dragging && "shadow-md"
      )}
    >
      {label}
    </div>
  );
}

function DatePicker({
  scene,
  view,
  controller,
  readOnly,
  compact,
}: {
  scene: DatabaseScene;
  view: DatabaseView;
  controller: DatabaseController;
  readOnly: boolean;
  compact?: boolean;
}) {
  const dateProps = scene.properties.filter((p) => p.type === "DATE");
  const current = dateProps.find((p) => p.id === view.config.datePropertyId);

  if (readOnly) {
    return compact ? null : (
      <div className="p-8 text-sm text-muted-foreground">
        This calendar has no date property configured.
      </div>
    );
  }

  const trigger = (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" data-icon="inline-end" />}>
        Date: {current?.name ?? "Choose a Date property"}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {dateProps.length === 0 && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">Add a Date property first.</div>
        )}
        {dateProps.map((property) => (
          <DropdownMenuItem
            key={property.id}
            onClick={() => controller.updateView(view.id, { config: { datePropertyId: property.id } })}
          >
            {property.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (compact) return trigger;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="text-sm text-muted-foreground">
        Pick a <span className="font-medium">Date</span> property to place rows on the calendar.
      </p>
      {trigger}
    </div>
  );
}
