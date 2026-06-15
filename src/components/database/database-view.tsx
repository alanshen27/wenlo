"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  CalendarDays,
  Columns3,
  Loader2,
  MoreHorizontal,
  Plus,
  Table2,
  Trash2,
} from "lucide-react";
import { useLibrary } from "@/components/library/library-shell";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDatabase } from "@/components/database/use-database";
import { DatabaseTable } from "@/components/database/database-table";
import { DatabaseBoard } from "@/components/database/database-board";
import { DatabaseCalendar } from "@/components/database/database-calendar";
import { apiPatch } from "@/lib/client/api";
import { libraryHome } from "@/lib/client/routes";
import { VIEW_TYPE_LABELS, type ViewType } from "@/lib/databases/database-schema";
import { cn } from "@/lib/core/utils";

const VIEW_ICONS: Record<ViewType, typeof Table2> = {
  TABLE: Table2,
  BOARD: Columns3,
  CALENDAR: CalendarDays,
};

export function DatabaseView() {
  const router = useRouter();
  const { databaseId } = useParams<{ databaseId: string }>();
  const { libraryId, canEdit, setHeader, refreshTree } = useLibrary();
  const controller = useDatabase(databaseId, !canEdit);
  const { scene, saveStatus, readOnly, notFound, activeViewId, setActiveViewId } = controller;

  const [title, setTitle] = useState("");

  useEffect(() => {
    if (scene) setTitle(scene.title);
  }, [scene]);

  useEffect(() => {
    if (notFound) router.replace(libraryHome(libraryId));
  }, [notFound, libraryId, router]);

  useEffect(() => {
    if (!scene) return;
    setHeader({ saveStatus, titleOverride: title, folderIdFallback: scene.folderId });
  }, [scene, saveStatus, title, setHeader]);

  const saveTitle = useCallback(async () => {
    if (readOnly || !scene || title === scene.title) return;
    try {
      const updated = await apiPatch<{ title: string }>(`/api/documents/${databaseId}`, { title });
      setTitle(updated.title);
      refreshTree();
    } catch {
      /* keep local title */
    }
  }, [databaseId, title, readOnly, scene, refreshTree]);

  if (!scene) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeView = scene.views.find((v) => v.id === activeViewId) ?? scene.views[0] ?? null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          readOnly={readOnly}
          placeholder="Untitled database"
          className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none read-only:cursor-default"
        />
        {readOnly && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            Read-only
          </span>
        )}
      </div>

      {/* View tabs */}
      <div className="flex items-center gap-1 border-b border-border px-3 py-1.5">
        {scene.views.map((view) => {
          const Icon = VIEW_ICONS[view.type];
          const active = view.id === activeView?.id;
          return (
            <div key={view.id} className="group/tab flex items-center">
              <button
                type="button"
                onClick={() => setActiveViewId(view.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm transition-colors",
                  active
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" />
                {view.name}
              </button>
              {active && !readOnly && (
                <ViewMenu view={view} controller={controller} canDelete={scene.views.length > 1} />
              )}
            </div>
          );
        })}

        {!readOnly && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button size="icon-sm" variant="ghost" aria-label="Add view" />}
            >
              <Plus className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              {(["TABLE", "BOARD", "CALENDAR"] as ViewType[]).map((type) => {
                const Icon = VIEW_ICONS[type];
                return (
                  <DropdownMenuItem key={type} onClick={() => controller.addView(type)}>
                    <Icon className="size-3.5" />
                    {VIEW_TYPE_LABELS[type]}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Active view */}
      {activeView?.type === "TABLE" && <DatabaseTable controller={controller} />}
      {activeView?.type === "BOARD" && <DatabaseBoard controller={controller} view={activeView} />}
      {activeView?.type === "CALENDAR" && (
        <DatabaseCalendar controller={controller} view={activeView} />
      )}
      {!activeView && (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          No views. Add one to get started.
        </div>
      )}
    </div>
  );
}

function ViewMenu({
  view,
  controller,
  canDelete,
}: {
  view: { id: string; name: string };
  controller: ReturnType<typeof useDatabase>;
  canDelete: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(view.name);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next && name.trim() && name !== view.name) {
          controller.updateView(view.id, { name: name.trim() });
        }
      }}
    >
      <PopoverTrigger
        render={
          <Button size="icon-xs" variant="ghost" className="ml-0.5" aria-label="View options" />
        }
      >
        <MoreHorizontal className="size-3.5 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (name.trim()) controller.updateView(view.id, { name: name.trim() });
              setOpen(false);
            }
          }}
          placeholder="View name"
          className="mb-1 w-full rounded-md border border-border bg-transparent px-2 py-1 text-sm outline-none focus:border-ring"
        />
        {canDelete && (
          <button
            type="button"
            onClick={() => {
              controller.deleteView(view.id);
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="size-3.5" />
            Delete view
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
