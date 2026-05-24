"use client";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";
import type { BreadcrumbItem } from "@/lib/folders";

type Props = {
  breadcrumbs: BreadcrumbItem[];
  hrefFor: (item: BreadcrumbItem) => string | null;
  saving?: boolean;
};

export function MainHeader({ breadcrumbs, hrefFor, saving }: Props) {
  return (
    <header className="flex h-11 shrink-0 items-center justify-between gap-4 border-b border-border px-4">
      <NavBreadcrumb items={breadcrumbs} hrefFor={hrefFor} />
      <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
        {saving && <span>Saving…</span>}
      </div>
    </header>
  );
}
