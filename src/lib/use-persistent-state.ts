"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * State backed by `localStorage`. Starts from `fallback` on the server and the
 * first client render (to avoid hydration mismatches), then hydrates from
 * storage in an effect. Writes are persisted as JSON.
 */
export function usePersistentState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored !== null) setValue(JSON.parse(stored) as T);
    } catch {
      // ignore malformed / unavailable storage
    }
    setHydrated(true);
  }, [key]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved =
          typeof next === "function" ? (next as (prev: T) => T)(prev) : next;
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          // ignore unavailable storage
        }
        return resolved;
      });
    },
    [key]
  );

  return [value, update, hydrated] as const;
}
