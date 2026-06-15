"use client";

import * as Y from "yjs";
import { BlockNoteEditor } from "@blocknote/core";
import { blocksToYXmlFragment, yXmlFragmentToBlocks } from "@blocknote/core/yjs";
import { YJS_FRAGMENT } from "@/lib/collab/config";
import { blockNoteSchema, multiColumnEditorOptions } from "@/lib/editor/blocknote-schema";
import { blocksToPlainText, normalizeEditorContent } from "@/lib/editor/editor-content";

/** Apply page JSON blocks into a live Yjs doc (client editor schema). */
export function applyPageContentToYjsDoc(doc: Y.Doc, content: unknown): void {
  const editor = BlockNoteEditor.create({
    ...multiColumnEditorOptions,
    schema: blockNoteSchema,
    initialContent: normalizeEditorContent(content),
  });
  blocksToYXmlFragment(editor, editor.document, doc.getXmlFragment(YJS_FRAGMENT));
}

export function isYjsDocEffectivelyEmpty(doc: Y.Doc): boolean {
  const fragment = doc.getXmlFragment(YJS_FRAGMENT);
  if (fragment.length === 0) return true;

  const editor = BlockNoteEditor.create({
    ...multiColumnEditorOptions,
    schema: blockNoteSchema,
  });
  const blocks = yXmlFragmentToBlocks(editor, fragment);
  return blocksToPlainText(blocks).trim().length < 5;
}
