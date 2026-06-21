"use client";

import { useCallback, useRef, useState } from "react";
import type { Library } from "@/components/sidebar/library-switcher";

export type LibraryPickerOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  defaultLibraryId?: string | null;
};

export function useLibraryPicker(
  libraries: Library[] | null,
  fallbackLibraryId: string | null
) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<LibraryPickerOptions | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const resolverRef = useRef<((id: string | null) => void) | null>(null);

  const prompt = useCallback(
    (opts: LibraryPickerOptions): Promise<string | null> => {
      if (!libraries) return Promise.resolve(null);
      if (libraries.length === 0) return Promise.resolve(null);
      if (libraries.length === 1) return Promise.resolve(libraries[0].id);

      const preferred = opts.defaultLibraryId ?? fallbackLibraryId;
      const defaultId =
        preferred && libraries.some((l) => l.id === preferred)
          ? preferred
          : libraries[0].id;

      setOptions(opts);
      setSelectedId(defaultId);
      setOpen(true);

      return new Promise((resolve) => {
        resolverRef.current = resolve;
      });
    },
    [libraries, fallbackLibraryId]
  );

  const settle = useCallback((id: string | null) => {
    resolverRef.current?.(id);
    resolverRef.current = null;
    setOpen(false);
    setOptions(null);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) settle(null);
    },
    [settle]
  );

  const confirm = useCallback(() => {
    if (selectedId) settle(selectedId);
  }, [selectedId, settle]);

  return {
    open,
    options,
    selectedId,
    setSelectedId,
    libraries: libraries ?? [],
    prompt,
    confirm,
    handleOpenChange,
  };
}
