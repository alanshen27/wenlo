"use client";

import type { BlockNoteEditor } from "@blocknote/core";
import type {
  RecallBlockSchema,
  RecallInlineSchema,
  RecallStyleSchema,
} from "@/lib/blocknote-schema";
import { useEffect } from "react";
import type * as Y from "yjs";
import { ySyncPluginKey, yUndoPluginKey } from "y-prosemirror";

/**
 * y-prosemirror destroys UndoManager when ProseMirror plugin views are torn
 * down (React Strict Mode, late plugin registration). Re-wire the handler so
 * Cmd+Z works again. See yjs/y-prosemirror#114 and BlockNote#2244.
 */
export function repairYjsUndoManager(
  doc: Y.Doc,
  editor: BlockNoteEditor<RecallBlockSchema, RecallInlineSchema, RecallStyleSchema>
): boolean {
  const tiptap = editor._tiptapEditor;
  if (!tiptap?.view) return false;

  const undoManager = yUndoPluginKey.getState(tiptap.state)?.undoManager;
  if (!undoManager) return false;

  const handler = undoManager.afterTransactionHandler;
  if (handler) {
    doc.off("afterTransaction", handler);
    doc.on("afterTransaction", handler);
  }

  undoManager.trackedOrigins.add(ySyncPluginKey);
  undoManager.trackedOrigins.add(undoManager);

  return true;
}

export function useRepairYjsUndo(
  doc: Y.Doc,
  editor: BlockNoteEditor<RecallBlockSchema, RecallInlineSchema, RecallStyleSchema>
) {
  useEffect(() => {
    const tiptap = editor._tiptapEditor;
    if (!tiptap) return;

    const run = () => {
      repairYjsUndoManager(doc, editor);
    };

    run();
    tiptap.on("mount", run);

    return () => {
      tiptap.off("mount", run);
    };
  }, [doc, editor]);
}
