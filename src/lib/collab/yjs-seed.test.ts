import { describe, expect, it } from "vitest";
import { BlockNoteEditor } from "@blocknote/core";
import { blockNoteServerSchema } from "@/lib/editor/blocknote-server-schema";
import { normalizeEditorContent } from "@/lib/editor/editor-content";
import { PAGE_TEMPLATES } from "@/lib/native/page-templates";
import { encodeYjsStateFromContent } from "@/lib/collab/yjs-content-encoding";

describe("yjs content encoding", () => {
  it("encodes page templates with the server schema", async () => {
    const state = await encodeYjsStateFromContent(PAGE_TEMPLATES[0].content);
    expect(state.byteLength).toBeGreaterThan(0);
  });

  it("creates editors from templates without the client pageLink schema", () => {
    const editor = BlockNoteEditor.create({
      schema: blockNoteServerSchema,
      initialContent: normalizeEditorContent(PAGE_TEMPLATES[0].content),
    });
    expect(editor.document.length).toBe(PAGE_TEMPLATES[0].content.length);
  });
});
