"use client";

import { useState } from "react";
import {
  ArrowDownAZ,
  ArrowUpZA,
  ChevronDown,
  LayoutGrid,
  List,
  Loader2,
  Mic,
  Plus,
  Shapes,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileArtwork, FolderArtwork } from "@/lib/client/file-icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/core/utils";

export type ViewMode = "grid" | "list";
export type SortMode = "name-asc" | "name-desc" | "type";

const SORT_LABELS: Record<SortMode, string> = {
  "name-asc": "Name (A–Z)",
  "name-desc": "Name (Z–A)",
  type: "Type",
};

type Props = {
  canEdit: boolean;
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  sort: SortMode;
  onSortChange: (sort: SortMode) => void;
  onNewPage: () => void | Promise<void>;
  onNewBoard: () => void | Promise<void>;
  onNewDeck: () => void | Promise<void>;
  onNewDatabase: () => void | Promise<void>;
  onNewFlowchart: () => void | Promise<void>;
  onNewFolder: () => void;
  onUpload: () => void;
  onRecordVoiceNote?: () => void;
};

export function CloudToolbar({
  canEdit,
  view,
  onViewChange,
  sort,
  onSortChange,
  onNewPage,
  onNewBoard,
  onNewDeck,
  onNewDatabase,
  onNewFlowchart,
  onNewFolder,
  onUpload,
  onRecordVoiceNote,
}: Props) {
  const [creatingPage, setCreatingPage] = useState(false);

  async function handleNewPage() {
    if (creatingPage) return;
    setCreatingPage(true);
    try {
      await onNewPage();
    } finally {
      setCreatingPage(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTriggerSort sort={sort} />
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuRadioGroup
            value={sort}
            onValueChange={(value) => onSortChange(value as SortMode)}
          >
            <DropdownMenuRadioItem value="name-asc">{SORT_LABELS["name-asc"]}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="name-desc">{SORT_LABELS["name-desc"]}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="type">{SORT_LABELS["type"]}</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex items-center rounded-lg border border-border p-0.5">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Grid view"
          aria-pressed={view === "grid"}
          className={cn(view === "grid" && "bg-muted text-foreground")}
          onClick={() => onViewChange("grid")}
        >
          <LayoutGrid className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="List view"
          aria-pressed={view === "list"}
          className={cn(view === "list" && "bg-muted text-foreground")}
          onClick={() => onViewChange("list")}
        >
          <List className="size-4" />
        </Button>
      </div>

      {canEdit && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button data-icon="inline-end" disabled={creatingPage} />}
          >
            {creatingPage ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            {creatingPage ? "Creating…" : "New"}
            <ChevronDown className="size-4 opacity-70" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 **:[[role=menuitem]]:gap-3 **:[[role=menuitem]]:py-2.5 **:[[role=menuitem]]:text-sm">
            <DropdownMenuItem onClick={handleNewPage}>
              <FileArtwork type="PAGE" className="size-5" />
              New page
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onNewBoard}>
              <FileArtwork type="WHITEBOARD" className="size-5" />
              New whiteboard
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onNewDeck}>
              <FileArtwork type="DECK" className="size-5" />
              New deck
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onNewDatabase}>
              <FileArtwork type="DATABASE" className="size-5" />
              New database
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onNewFlowchart}>
              <FileArtwork type="FLOWCHART" className="size-5" />
              New flowchart
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onNewFolder}>
              <FolderArtwork color="yellow" className="size-5" />
              New folder
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onUpload}>
              <Upload className="size-4" />
              Upload files
            </DropdownMenuItem>
            {onRecordVoiceNote && (
              <DropdownMenuItem onClick={onRecordVoiceNote}>
                <Mic className="size-4" />
                Record voice note
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

function DropdownMenuTriggerSort({ sort }: { sort: SortMode }) {
  const Icon = sort === "name-desc" ? ArrowUpZA : sort === "type" ? Shapes : ArrowDownAZ;
  return (
    <DropdownMenuTrigger render={<Button variant="outline" data-icon="inline-start" />}>
      <Icon className="size-3.5" />
      <span className="hidden sm:inline">{SORT_LABELS[sort]}</span>
    </DropdownMenuTrigger>
  );
}
