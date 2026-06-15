import * as React from "react";
import { RotateCw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/core/utils";

/**
 * Shared layout primitives so every view uses the same page padding,
 * content widths, and header rhythm. Tweak spacing here once instead of
 * hunting for one-off `px-8 py-16` values across the app.
 */

const VIEW_WIDTHS = {
  narrow: "max-w-lg",
  prose: "max-w-3xl",
  content: "max-w-4xl",
  wide: "max-w-6xl",
  full: "max-w-none",
} as const;

type ViewWidth = keyof typeof VIEW_WIDTHS;

/** Scrollable region that fills the remaining height of the main column. */
function ViewScroll({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex-1 overflow-y-auto", className)} {...props} />;
}

/** Centered, width-constrained content well with consistent page padding. */
function ViewContainer({
  className,
  size = "content",
  ...props
}: React.ComponentProps<"div"> & { size?: ViewWidth }) {
  return (
    <div
      className={cn("mx-auto w-full px-6 py-8 md:px-10 md:py-10", VIEW_WIDTHS[size], className)}
      {...props}
    />
  );
}

type ViewHeaderProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

/** Title / description block with an optional trailing actions cluster. */
function ViewHeader({ title, description, eyebrow, icon, actions, className }: ViewHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && <div className="flex shrink-0 items-center">{icon}</div>}
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              {eyebrow}
            </p>
          )}
          <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Small section label used above grouped content. */
function SectionLabel({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-sm font-medium text-muted-foreground", className)}
      {...props}
    />
  );
}

type ViewErrorProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
};

/**
 * Centered failure state for a view that couldn't load. Use for transient
 * errors (network/server) where retrying is sensible — not for missing
 * resources, which should redirect away instead.
 */
function ViewError({
  title = "Couldn't load this",
  message,
  onRetry,
  className,
}: ViewErrorProps) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center",
        className
      )}
      role="alert"
    >
      <TriangleAlert className="size-8 text-muted-foreground" aria-hidden />
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {message && <p className="max-w-sm text-sm text-muted-foreground">{message}</p>}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw className="size-4" />
          Try again
        </Button>
      )}
    </div>
  );
}

export { ViewScroll, ViewContainer, ViewHeader, SectionLabel, ViewError, VIEW_WIDTHS };
export type { ViewWidth };
