"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/** App-wide toast host — styled to match wenlo design tokens. */
export function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      className="toaster group font-sans"
      closeButton
      richColors={false}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "group toast relative flex w-full items-center gap-2 overflow-hidden rounded-lg bg-popover px-3.5 py-3 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10",
          title: "font-medium leading-snug",
          description: "text-xs leading-relaxed text-muted-foreground",
          content: "flex min-w-0 flex-col gap-0.5",
          icon: "mr-0.5 size-4 shrink-0",
          actionButton:
            "inline-flex h-7 shrink-0 items-center rounded-lg bg-primary px-2.5 text-xs font-medium text-primary-foreground",
          cancelButton:
            "inline-flex h-7 shrink-0 items-center rounded-lg bg-muted px-2.5 text-xs font-medium text-muted-foreground",
          closeButton:
            "absolute top-0 right-0 flex size-5 -translate-y-1/3 translate-x-1/3 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-muted [&_svg]:size-3",
          error: "ring-destructive/25 [&_[data-icon]]:text-destructive",
          success:
            "ring-emerald-500/25 [&_[data-icon]]:text-emerald-600 dark:[&_[data-icon]]:text-emerald-400",
          info: "ring-primary/25 [&_[data-icon]]:text-primary",
          warning:
            "ring-amber-500/25 [&_[data-icon]]:text-amber-600 dark:[&_[data-icon]]:text-amber-400",
        },
      }}
      {...props}
    />
  );
}
