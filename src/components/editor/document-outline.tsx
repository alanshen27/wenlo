"use client";

import type { DocumentHeading } from "@/lib/editor/editor-content";
import { cn } from "@/lib/core/utils";

type Props = {
  headings: DocumentHeading[];
  onSelect: (blockId: string) => void;
};

export function DocumentOutline({ headings, onSelect }: Props) {
  if (headings.length === 0) return null;

  return (
    <aside className="pointer-events-none fixed top-12 right-6 z-10 hidden w-52 xl:block">
      <nav
        aria-label="Document outline"
        className="pointer-events-auto max-h-[calc(100vh-3rem)] overflow-x-hidden overflow-y-auto overscroll-contain py-2 scrollbar-subtle"
      >
        <p className="notion-sidebar-label mb-1 px-2">On this page</p>
        <ul className="min-w-0 space-y-0.5">
          {headings.map((heading) => (
            <li key={heading.id} className="min-w-0">
              <button
                type="button"
                onClick={() => onSelect(heading.id)}
                title={heading.text}
                className={cn(
                  "notion-nav-pill max-w-full truncate",
                  heading.level === 2 && "ml-2",
                  heading.level === 3 && "ml-4"
                )}
              >
                {heading.text}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
