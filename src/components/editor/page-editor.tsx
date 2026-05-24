"use client";

import dynamic from "next/dynamic";

export const PageEditor = dynamic(() => import("./block-editor").then((m) => m.BlockEditor), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
      Loading editor…
    </div>
  ),
});
