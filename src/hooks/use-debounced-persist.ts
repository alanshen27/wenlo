import { useCallback, useEffect, useRef } from "react";

/** Debounced flush with tab-close / unmount flush. */
export function useDebouncedFlush(flush: () => void, debounceMs = 600) {
  const flushRef = useRef(flush);
  flushRef.current = flush;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedule = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      flushRef.current();
    }, debounceMs);
  }, [debounceMs]);

  const flushNow = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    flushRef.current();
  }, []);

  useEffect(() => {
    const onBeforeUnload = () => flushRef.current();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      flushRef.current();
    };
  }, []);

  return { schedule, flushNow };
}

type PersistOptions<T> = {
  debounceMs?: number;
  shouldPersist?: () => boolean;
  getPayload: () => T | null | undefined;
  persist: (payload: T) => Promise<void>;
  markSaving: () => void;
  markSaved: () => void;
  markError: () => void;
};

/** Debounced autosave: mark dirty → schedule → flush → persist with save status callbacks. */
export function useDebouncedPersist<T>({
  debounceMs = 600,
  shouldPersist,
  getPayload,
  persist,
  markSaving,
  markSaved,
  markError,
}: PersistOptions<T>) {
  const dirtyRef = useRef(false);
  const getPayloadRef = useRef(getPayload);
  getPayloadRef.current = getPayload;
  const persistRef = useRef(persist);
  persistRef.current = persist;

  const flush = useCallback(async () => {
    if (shouldPersist?.() === false) return;
    if (!dirtyRef.current) return;
    const payload = getPayloadRef.current();
    if (payload == null) return;
    dirtyRef.current = false;
    markSaving();
    try {
      await persistRef.current(payload);
      markSaved();
    } catch {
      markError();
      dirtyRef.current = true;
    }
  }, [shouldPersist, markSaving, markSaved, markError]);

  const { schedule, flushNow } = useDebouncedFlush(() => void flush(), debounceMs);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    schedule();
  }, [schedule]);

  return { markDirty, flushNow };
}
