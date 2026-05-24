"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { libraryHome, readStoredLibraryId } from "@/lib/routes";
import { apiGet } from "@/lib/api";

export function RedirectToLibrary() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const libraries = await apiGet<{ id: string }[]>("/api/libraries");
        if (cancelled) return;
        const stored = readStoredLibraryId();
        const match = libraries.find((l) => l.id === stored);
        const id = match?.id ?? libraries[0]?.id;
        if (cancelled) return;
        if (id) router.replace(libraryHome(id));
      } catch {
        /* noop — same as !res.ok */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      Loading…
    </div>
  );
}
