"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { libraryHome, readStoredLibraryId } from "@/lib/routes";

export function RedirectToLibrary() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/libraries");
      if (!res.ok || cancelled) return;
      const libraries = (await res.json()) as { id: string }[];
      const stored = readStoredLibraryId();
      const match = libraries.find((l) => l.id === stored);
      const id = match?.id ?? libraries[0]?.id;
      if (cancelled) return;
      if (id) router.replace(libraryHome(id));
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
