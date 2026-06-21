import { useEffect } from "react";
import type { HeaderState } from "@/components/library/context";

/** Pushes document header state (save status, title, collaborators) into the library shell. */
export function useDocumentHeader(
  setHeader: (state: HeaderState) => void,
  header: HeaderState | undefined
) {
  useEffect(() => {
    if (header === undefined) return;
    setHeader(header);
  }, [setHeader, header]);
}
