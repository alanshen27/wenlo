"use client";

import Link from "next/link";
import { ChevronRight, File, FileCode, FileText, Folder, Library, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BreadcrumbItem } from "@/lib/folders";

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
          const Icon = iconFor(item.type);
          const href = !isLast ? hrefFor?.(item) : null;

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
                  <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  <span className="truncate">{item.name}</span>
                </span>
              ) : href ? (
                <Link
                  href={href}
                  className="flex min-w-0 items-center gap-1.5 truncate text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  <span className="truncate">{item.name}</span>
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigate?.(item)}
                  className="flex min-w-0 items-center gap-1.5 truncate text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
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

function iconFor(type: BreadcrumbItem["type"]) {
  switch (type) {
    case "library":
      return Library;
    case "folder":
      return Folder;
    case "page":
      return FileText;
    case "document":
      return FileCode;
    case "search":
      return Search;
    case "recall":
      return Sparkles;
    default:
      return File;
  }
}
