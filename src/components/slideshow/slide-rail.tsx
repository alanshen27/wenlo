"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Copy, Plus, Trash2 } from "lucide-react";
import type { DeckDoc } from "@/lib/decks/deck-schema";
import { DeckSlideSvg } from "@/components/slideshow/deck-slide-svg";
import { SLIDE_TEMPLATES, createSlideFromTemplate } from "@/lib/decks/deck-templates";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/core/utils";

/** Left rail: ordered slide thumbnails with add / reorder (drag) / duplicate /
 *  delete. Reordering uses @dnd-kit core (no sortable dep): each thumbnail is
 *  both draggable and a drop target, and we splice the order on drop. */
export function SlideRail({
  deck,
  activeSlideId,
  readOnly,
  onSelect,
  onAdd,
  onReorder,
  onDuplicate,
  onDelete,
}: {
  deck: DeckDoc;
  activeSlideId: string;
  readOnly: boolean;
  onSelect: (slideId: string) => void;
  onAdd: (templateId?: string) => void;
  onReorder: (slideId: string, toIndex: number) => void;
  onDuplicate: (slideId: string) => void;
  onDelete: (slideId: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );
  const [dragging, setDragging] = useState<string | null>(null);

  function handleDragStart(e: DragStartEvent) {
    setDragging(String(e.active.id));
  }

  function handleDragEnd(e: DragEndEvent) {
    setDragging(null);
    const activeId = String(e.active.id);
    if (!e.over) return;
    const overId = String(e.over.id);
    if (activeId === overId) return;
    const overIndex = deck.slideOrder.indexOf(overId);
    if (overIndex === -1) return;
    onReorder(activeId, overIndex);
  }

  return (
    <div className="flex h-full w-44 shrink-0 flex-col border-r border-border bg-muted/20">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">
          {deck.slideOrder.length} {deck.slideOrder.length === 1 ? "slide" : "slides"}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <ol className="flex flex-col gap-2">
            {deck.slideOrder.map((slideId, index) => (
              <SlideThumb
                key={slideId}
                slideId={slideId}
                index={index}
                deck={deck}
                active={slideId === activeSlideId}
                dragging={dragging === slideId}
                readOnly={readOnly}
                canDelete={deck.slideOrder.length > 1}
                onSelect={onSelect}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
              />
            ))}
          </ol>
        </DndContext>
      </div>
      {!readOnly && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="m-2 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              />
            }
          >
            <Plus className="size-3.5" />
            Add slide
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-64 p-2">
            <p className="px-1 pb-1.5 text-xs font-medium text-muted-foreground">
              Choose a layout
            </p>
            <div className="grid grid-cols-2 gap-2">
              {SLIDE_TEMPLATES.map((template) => (
                <TemplateChoice
                  key={template.id}
                  templateId={template.id}
                  label={template.label}
                  onPick={() => onAdd(template.id)}
                />
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

function TemplateChoice({
  templateId,
  label,
  onPick,
}: {
  templateId: string;
  label: string;
  onPick: () => void;
}) {
  // Build a throwaway slide just to render a faithful thumbnail of the layout.
  const slide = useMemo(() => createSlideFromTemplate(templateId), [templateId]);
  return (
    <button
      type="button"
      onClick={onPick}
      className="group flex flex-col gap-1 rounded-md border border-border p-1 text-left transition-colors hover:border-primary hover:bg-accent/50"
    >
      <span className="aspect-video w-full overflow-hidden rounded border border-border bg-white">
        <DeckSlideSvg slide={slide} className="h-full w-full" ariaLabel={`${label} layout`} />
      </span>
      <span className="truncate text-[11px] text-muted-foreground group-hover:text-foreground">
        {label}
      </span>
    </button>
  );
}

function SlideThumb({
  slideId,
  index,
  deck,
  active,
  dragging,
  readOnly,
  canDelete,
  onSelect,
  onDuplicate,
  onDelete,
}: {
  slideId: string;
  index: number;
  deck: DeckDoc;
  active: boolean;
  dragging: boolean;
  readOnly: boolean;
  canDelete: boolean;
  onSelect: (slideId: string) => void;
  onDuplicate: (slideId: string) => void;
  onDelete: (slideId: string) => void;
}) {
  const draggable = useDraggable({ id: slideId, disabled: readOnly });
  const droppable = useDroppable({ id: slideId });

  return (
    <li
      ref={droppable.setNodeRef}
      className={cn("group relative flex items-start gap-1.5", dragging && "opacity-40")}
    >
      <span className="w-4 pt-1 text-right text-[10px] text-muted-foreground">{index + 1}</span>
      <button
        type="button"
        ref={draggable.setNodeRef}
        {...draggable.listeners}
        {...draggable.attributes}
        onClick={() => onSelect(slideId)}
        className={cn(
          "relative aspect-video flex-1 overflow-hidden rounded-md border bg-white shadow-sm transition-all",
          active
            ? "border-primary ring-2 ring-primary/40"
            : "border-border hover:border-primary/50",
          droppable.isOver && "ring-2 ring-primary"
        )}
      >
        <DeckSlideSvg slide={deck.slides[slideId]} className="h-full w-full" />
      </button>
      {!readOnly && (
        <div className="absolute right-1 top-1 flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            aria-label="Duplicate slide"
            title="Duplicate slide"
            onClick={() => onDuplicate(slideId)}
            className="flex size-5 items-center justify-center rounded bg-popover/90 text-muted-foreground shadow hover:text-foreground"
          >
            <Copy className="size-3" />
          </button>
          {canDelete && (
            <button
              type="button"
              aria-label="Delete slide"
              title="Delete slide"
              onClick={() => onDelete(slideId)}
              className="flex size-5 items-center justify-center rounded bg-popover/90 text-muted-foreground shadow hover:text-destructive"
            >
              <Trash2 className="size-3" />
            </button>
          )}
        </div>
      )}
    </li>
  );
}
