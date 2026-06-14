"use client";

import Link from "next/link";
import { FolderIcon } from "@/components/icons/folder-icon";
import type { FolderContents } from "@/lib/library/folders";
import { getDocumentIcon, getDocumentIconClass, PageIcon } from "@/lib/client/file-icons";
import { documentRoute, folderHome, pageRoute } from "@/lib/client/routes";
import { cn } from "@/lib/core/utils";

type Props = {
  libraryId: string;
  contents: FolderContents;
};

export function LibraryContentIndex({ libraryId, contents }: Props) {
  const { folders, pages, documents } = contents;
  const items = [
    ...folders.map((f) => ({ kind: "folder" as const, id: f.id, title: f.name, color: f.color })),
    ...pages.map((p) => ({ kind: "page" as const, id: p.id, title: p.title })),
    ...documents
      .filter((d) => !d.pending)
      .map((d) => ({ kind: "document" as const, id: d.id, title: d.title, type: d.type })),
  ];

  if (items.length === 0) return null;

  return (
    <div className="mt-8">
      <p className="mb-2 text-sm font-medium text-muted-foreground">
        In this folder
      </p>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {items.map((item) => {
          const href =
            item.kind === "folder"
              ? folderHome(libraryId, item.id)
              : item.kind === "page"
                ? pageRoute(libraryId, item.id)
                : documentRoute(libraryId, item.id);

          const Icon =
            item.kind === "folder"
              ? null
              : item.kind === "page"
                ? PageIcon
                : getDocumentIcon(item.type);

          return (
            <li key={`${item.kind}-${item.id}`}>
              <Link
                href={href}
                className="flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-muted/50"
              >
                {item.kind === "folder" ? (
                  <FolderIcon color={item.color} className="size-3.5 shrink-0" />
                ) : (
                  Icon && (
                    <Icon
                      className={cn(
                        "size-3.5 shrink-0",
                        item.kind === "document" ? getDocumentIconClass(item.type) : "text-muted-foreground"
                      )}
                    />
                  )
                )}
                <span className="truncate">{item.title}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
