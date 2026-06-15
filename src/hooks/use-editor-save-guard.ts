import { useCallback, useEffect, useRef } from "react";
import {
  blocksToPlainText,
  normalizeEditorContent,
  type RecallPartialBlock,
} from "@/lib/editor/editor-content";

/**
 * Prevents autosave from firing during editor mount/hydration. BlockNote can
 * emit an onChange with an empty doc before initialContent (or Yjs) is applied,
 * which would overwrite a freshly created template in the database.
 */
export function useEditorSaveGuard(
  pageId: string,
  content: unknown,
  syncKey = 0
) {
  const hydratedRef = useRef(false);
  const baselinePlainRef = useRef("");

  useEffect(() => {
    baselinePlainRef.current = blocksToPlainText(normalizeEditorContent(content));
    hydratedRef.current = false;
    const timer = window.setTimeout(() => {
      hydratedRef.current = true;
    }, 250);
    return () => clearTimeout(timer);
  }, [pageId, syncKey, content]);

  const shouldPersist = useCallback((blocks: RecallPartialBlock[]) => {
    if (!hydratedRef.current) return false;
    const plain = blocksToPlainText(blocks);
    const baseline = baselinePlainRef.current;
    if (baseline.length > 40 && plain.length < baseline.length * 0.3) {
      return false;
    }
    return true;
  }, []);

  const markPersisted = useCallback((blocks: RecallPartialBlock[]) => {
    baselinePlainRef.current = blocksToPlainText(blocks);
  }, []);

  return { shouldPersist, markPersisted };
}
