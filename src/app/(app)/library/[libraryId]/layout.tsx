import { Suspense } from "react";
import { LibraryShell } from "@/components/library/library-shell";

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <LibraryShell>{children}</LibraryShell>
    </Suspense>
  );
}
