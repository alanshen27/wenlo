"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { FileText } from "lucide-react";
import { FolderIcon } from "@/components/icons/folder-icon";
import { LibraryIcon } from "@/components/icons/library-icon";
import type { MindMapNodeData } from "@/lib/pages/mind-map-layout";
import { getFolderColorHex } from "@/lib/library/folder-colors";
import { cn } from "@/lib/core/utils";

function MindMapNodeComponent({ data, selected }: NodeProps) {
  const { label, kind, color, libraryIcon, dimmed, degree, scale } =
    data as MindMapNodeData;

  const isHub = kind === "page" && degree >= 3;
  // Pages scale up with their cross-link degree; folders/library stay fixed.
  const pageScale = Math.min(scale, 1.6);

  return (
    <>
      <Handle type="target" position={Position.Top} className="!border-0 !bg-transparent !opacity-0" />
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border shadow-sm transition-all duration-200",
          kind === "library" &&
            "border-primary/30 bg-gradient-to-br from-primary/15 to-primary/5 px-3 py-2 font-medium text-foreground",
          kind === "folder" && "border-border bg-card px-3 py-2 text-card-foreground",
          kind === "page" &&
            "cursor-pointer border-border/80 bg-background hover:border-primary/40 hover:shadow-md",
          isHub && "border-primary/40 bg-primary/5 font-medium shadow-md",
          selected && kind === "page" && "border-primary ring-2 ring-primary/20",
          dimmed && "opacity-25"
        )}
        style={
          kind === "page"
            ? {
                paddingInline: 12 * pageScale,
                paddingBlock: 8 * pageScale,
                ...(color ? {} : {}),
              }
            : kind === "folder" && color
              ? { borderLeftWidth: 3, borderLeftColor: getFolderColorHex(color) }
              : undefined
        }
      >
        {kind === "library" && <LibraryIcon icon={libraryIcon} className="size-5" />}
        {kind === "folder" && color && (
          <FolderIcon color={color} className="size-4 shrink-0" />
        )}
        {kind === "page" && (
          <FileText
            className={cn(
              "shrink-0 text-muted-foreground",
              isHub ? "text-primary" : "text-muted-foreground"
            )}
            style={{ width: 14 * pageScale, height: 14 * pageScale }}
          />
        )}
        <span
          className="min-w-0 truncate leading-tight"
          style={
            kind === "page"
              ? { fontSize: 12 * pageScale, maxWidth: 150 * pageScale }
              : { fontSize: 12 }
          }
        >
          {label}
        </span>
        {isHub && (
          <span className="ml-0.5 shrink-0 rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">
            {degree}
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!border-0 !bg-transparent !opacity-0" />
    </>
  );
}

export const MindMapNode = memo(MindMapNodeComponent);
