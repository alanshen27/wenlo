import * as Y from "yjs";
import { YJS_FRAGMENT } from "@/lib/collab/config";
import { blockNoteServerSchema } from "@/lib/editor/blocknote-server-schema";
import { blocksToPlainText, normalizeEditorContent } from "@/lib/editor/editor-content";

/** True when JSON page content has enough text to treat as a real template/doc. */
export function hasSubstantialPageContent(content: unknown): boolean {
  return blocksToPlainText(normalizeEditorContent(content)).trim().length > 40;
}

/** Encode BlockNote JSON blocks as a Yjs update (server-safe). */
export async function encodeYjsStateFromContent(content: unknown): Promise<Uint8Array> {
  const { BlockNoteEditor } = await import("@blocknote/core");
  const { blocksToYXmlFragment } = await import("@blocknote/core/yjs");

  const doc = new Y.Doc();
  const tempEditor = BlockNoteEditor.create({
    schema: blockNoteServerSchema,
    initialContent: normalizeEditorContent(content),
  });

  blocksToYXmlFragment(tempEditor, tempEditor.document, doc.getXmlFragment(YJS_FRAGMENT));
  return Y.encodeStateAsUpdate(doc);
}

/** True when a stored Yjs snapshot has little or no editable text. */
export async function isYjsStateEffectivelyEmpty(state: Uint8Array): Promise<boolean> {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, state);
  const fragment = doc.getXmlFragment(YJS_FRAGMENT);
  if (fragment.length === 0) return true;

  const { BlockNoteEditor } = await import("@blocknote/core");
  const { yXmlFragmentToBlocks } = await import("@blocknote/core/yjs");
  const editor = BlockNoteEditor.create({ schema: blockNoteServerSchema });
  const blocks = yXmlFragmentToBlocks(editor, fragment);
  return blocksToPlainText(blocks).trim().length < 5;
}
