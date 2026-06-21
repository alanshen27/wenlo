import { useCallback, useEffect, useRef, useState } from "react";
import type { SaveStatus } from "@/components/native/save-status-indicator";

/** Tracks autosave status with a brief "saved" flash before returning to idle. */
export function useSaveStatus(savedIdleMs = 1500) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetSaveStatus = useCallback(() => {
    setSaveStatus("idle");
  }, []);

  const markSaving = useCallback(() => {
    setSaveStatus("saving");
  }, []);

  const markSaved = useCallback(() => {
    setSaveStatus("saved");
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaveStatus("idle"), savedIdleMs);
  }, [savedIdleMs]);

  const markError = useCallback(() => {
    setSaveStatus("error");
  }, []);

  useEffect(() => {
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  return {
    saveStatus,
    setSaveStatus,
    resetSaveStatus,
    markSaving,
    markSaved,
    markError,
  };
}
