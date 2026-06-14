import { Skeleton } from "@/components/ui/skeleton";

/** Body-only skeleton (no title) for editor mount/connect fallbacks. */
export function EditorBodySkeleton() {
  const lines = ["100%", "92%", "78%", "100%", "64%", "88%", "40%"];
  return (
    <div className="min-h-[50vh] w-full space-y-3.5 py-2" aria-hidden>
      {lines.map((width, i) => (
        <Skeleton key={i} className="h-4" style={{ width }} />
      ))}
      <div className="h-3" />
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="h-4 w-[70%]" />
      <Skeleton className="h-4 w-[55%]" />
    </div>
  );
}

/** Full page skeleton (title + body) matching the page-view layout. */
export function PageSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-8 py-12 md:px-16">
        <Skeleton className="mb-6 h-10 w-2/3" />
        <EditorBodySkeleton />
      </div>
    </div>
  );
}
