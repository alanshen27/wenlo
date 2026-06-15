"use client";

import Link from "next/link";
import { ChevronRight, File, FileCode, FileText, Folder, Library, Search, Sparkles } from "lucide-react";
import { FolderArtwork } from "@/lib/client/file-icons";
import { cn } from "@/lib/core/utils";
import type { BreadcrumbItem } from "@/lib/library/folders";

type Props = {
  items: BreadcrumbItem[];
  hrefFor?: (item: BreadcrumbItem) => string | null;
  onNavigate?: (item: BreadcrumbItem) => void;
};

export function NavBreadcrumb({ items, hrefFor, onNavigate }: Props) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-sm">
      <ol className="flex min-w-0 items-center gap-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const href = !isLast ? hrefFor?.(item) : null;
          const icon = <CrumbIcon item={item} />;

          return (
            <li key={`${item.type}-${item.id}`} className="flex min-w-0 items-center gap-1">
              {index > 0 && (
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              )}
              {isLast ? (
                <span
                  className={cn(
                    "flex min-w-0 items-center gap-1.5 truncate font-medium text-foreground"
                  )}
                  aria-current="page"
                >
                  {icon}
                  <span className="truncate">{item.name}</span>
                </span>
              ) : href ? (
                <Link
                  href={href}
                  className="flex min-w-0 items-center gap-1.5 truncate text-muted-foreground transition-colors hover:text-foreground"
                >
                  {icon}
                  <span className="truncate">{item.name}</span>
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigate?.(item)}
                  className="flex min-w-0 items-center gap-1.5 truncate text-muted-foreground transition-colors hover:text-foreground"
                >
                  {icon}
                  <span className="truncate">{item.name}</span>
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function CrumbIcon({ item }: { item: BreadcrumbItem }) {
  const className = "h-3.5 w-3.5 shrink-0 opacity-70";

  if (item.type === "folder" && item.color) {
    return <FolderArtwork color={item.color} className="size-4 shrink-0" />;
  }

  switch (item.type) {
    case "library":
      return <Library className={className} />;
    case "folder":
      return <Folder className={className} />;
    case "page":
      return <FileText className={className} />;
    case "document":
      return <FileCode className={className} />;
    case "search":
      return <Search className={className} />;
    case "recall":
      return <Sparkles className={className} />;
    default:
      return <File className={className} />;
  }
}
