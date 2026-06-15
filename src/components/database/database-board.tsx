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
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CellDisplay, OptionPill } from "@/components/database/cell-editors";
import type { DatabaseController } from "@/components/database/use-database";
import {
  primaryProperty,
  type DatabaseProperty,
  type DatabaseRowData,
  type DatabaseScene,
  type DatabaseView,
  type SelectOption,
} from "@/lib/databases/database-schema";
import { cn } from "@/lib/core/utils";

const NO_LANE = "__none__";

export function DatabaseBoard({
  controller,
  view,
}: {
  controller: DatabaseController;
  view: DatabaseView;
}) {
  const { scene, readOnly } = controller;
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const groupProperty = scene?.properties.find(
    (p) => p.id === view.config.groupPropertyId && p.type === "SELECT"
  );

  const lanes = useMemo(() => {
    if (!scene || !groupProperty) return [];
    const byOption = new Map<string, DatabaseRowData[]>();
    byOption.set(NO_LANE, []);
    for (const option of groupProperty.options) byOption.set(option.id, []);
    for (const row of scene.rows) {
      const value = row.cells[groupProperty.id];
      const key = typeof value === "string" && byOption.has(value) ? value : NO_LANE;
      byOption.get(key)!.push(row);
    }
    return [
      ...groupProperty.options.map((option) => ({ option, rows: byOption.get(option.id) ?? [] })),
      { option: null as SelectOption | null, rows: byOption.get(NO_LANE) ?? [] },
    ];
  }, [scene, groupProperty]);

  if (!scene) return null;

  if (!groupProperty) {
    return (
      <GroupPicker
        scene={scene}
        view={view}
        controller={controller}
        readOnly={readOnly}
        kind="board"
      />
    );
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveRowId(null);
    const rowId = String(event.active.id);
    const over = event.over?.id;
    if (!over || !groupProperty) return;
    const laneKey = String(over).replace(/^lane:/, "");
    const optionId = laneKey === NO_LANE ? null : laneKey;
    const current = scene!.rows.find((r) => r.id === rowId)?.cells[groupProperty.id] ?? null;
    if (current !== optionId) controller.setCell(rowId, groupProperty.id, optionId);
  }

  const primary = primaryProperty(scene.properties);
  const activeRow = activeRowId ? scene.rows.find((r) => r.id === activeRowId) : null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-3">
        <GroupPicker
          scene={scene}
          view={view}
          controller={controller}
          readOnly={readOnly}
          kind="board"
          compact
        />
      </div>
      <DndContext
        sensors={sensors}
        onDragStart={(e: DragStartEvent) => setActiveRowId(String(e.active.id))}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveRowId(null)}
      >
        <div className="flex flex-1 gap-3 overflow-x-auto p-4">
          {lanes.map(({ option, rows }) => (
            <Lane
              key={option?.id ?? NO_LANE}
              option={option}
              rows={rows}
              properties={scene.properties}
              primary={primary}
              groupProperty={groupProperty}
              readOnly={readOnly}
              onAddCard={() =>
                controller.addRow(option ? { [groupProperty.id]: option.id } : undefined)
              }
            />
          ))}
        </div>
        <DragOverlay>
          {activeRow && primary ? (
            <Card
              row={activeRow}
              properties={scene.properties}
              primary={primary}
              groupProperty={groupProperty}
              dragging
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function Lane({
  option,
  rows,
  properties,
  primary,
  groupProperty,
  readOnly,
  onAddCard,
}: {
  option: SelectOption | null;
  rows: DatabaseRowData[];
  properties: DatabaseProperty[];
  primary: DatabaseProperty | null;
  groupProperty: DatabaseProperty;
  readOnly: boolean;
  onAddCard: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `lane:${option?.id ?? NO_LANE}` });

  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        {option ? (
          <OptionPill option={option} />
        ) : (
          <span className="text-xs font-medium text-muted-foreground">No {groupProperty.name}</span>
        )}
        <span className="text-xs text-muted-foreground/60">{rows.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-1 flex-col gap-2 rounded-lg border border-transparent p-1 transition-colors",
          isOver && "border-primary/40 bg-primary/5"
        )}
      >
        {rows.map((row) =>
          primary ? (
            <DraggableCard
              key={row.id}
              row={row}
              properties={properties}
              primary={primary}
              groupProperty={groupProperty}
              readOnly={readOnly}
            />
          ) : null
        )}
        {!readOnly && (
          <button
            type="button"
            onClick={onAddCard}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Plus className="size-3.5" />
            Add card
          </button>
        )}
      </div>
    </div>
  );
}

function DraggableCard(props: {
  row: DatabaseRowData;
  properties: DatabaseProperty[];
  primary: DatabaseProperty;
  groupProperty: DatabaseProperty;
  readOnly: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: props.row.id,
    disabled: props.readOnly,
  });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={cn(isDragging && "opacity-40")}>
      <Card {...props} />
    </div>
  );
}

function Card({
  row,
  properties,
  primary,
  groupProperty,
  dragging,
}: {
  row: DatabaseRowData;
  properties: DatabaseProperty[];
  primary: DatabaseProperty;
  groupProperty: DatabaseProperty;
  dragging?: boolean;
}) {
  const secondary = properties.filter((p) => p.id !== primary.id && p.id !== groupProperty.id);
  const title = row.cells[primary.id];

  return (
    <div
      className={cn(
        "cursor-grab rounded-lg border border-border bg-card p-2.5 shadow-sm active:cursor-grabbing",
        dragging && "shadow-md"
      )}
    >
      <div className="truncate text-sm font-medium">
        {title ? String(title) : <span className="text-muted-foreground/50">Untitled</span>}
      </div>
      {secondary.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {secondary.map((property) => {
            const value = row.cells[property.id];
            if (value === null || value === undefined || value === "") return null;
            return (
              <span key={property.id} className="text-xs text-muted-foreground">
                <CellDisplay property={property} value={value} />
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Lets the user choose which SELECT property groups the board. */
function GroupPicker({
  scene,
  view,
  controller,
  readOnly,
  kind,
  compact,
}: {
  scene: DatabaseScene;
  view: DatabaseView;
  controller: DatabaseController;
  readOnly: boolean;
  kind: "board";
  compact?: boolean;
}) {
  const selectProps = scene.properties.filter((p) => p.type === "SELECT");
  const current = selectProps.find((p) => p.id === view.config.groupPropertyId);

  if (readOnly) {
    return compact ? null : (
      <div className="p-8 text-sm text-muted-foreground">
        This board has no group property configured.
      </div>
    );
  }

  const trigger = (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" data-icon="inline-end" />}>
        Group by: {current?.name ?? "Choose a Select property"}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        {selectProps.length === 0 && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            Add a Select property first.
          </div>
        )}
        {selectProps.map((property) => (
          <DropdownMenuItem
            key={property.id}
            onClick={() =>
              controller.updateView(view.id, { config: { groupPropertyId: property.id } })
            }
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
        Pick a <span className="font-medium">Select</span> property to group cards into columns.
      </p>
      {trigger}
    </div>
  );
}
