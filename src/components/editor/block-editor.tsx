"use client";

import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/shadcn/style.css";
import { useCallback, useMemo, useRef, useState } from "react";
import { blocknoteShadCNComponents } from "@/components/editor/blocknote-shadcn-components";
import { MermaidPreviews } from "@/components/editor/mermaid-previews";
import { blockNoteSchema } from "@/lib/blocknote-schema";
import { blocksToPlainText, normalizeEditorContent } from "@/lib/editor-content";
import { debounce } from "@/lib/utils";
import type { PartialBlock } from "@blocknote/core";

type Props = {
  pageId: string;
  content: unknown;
  onChange: (content: unknown, plainText: string) => void;
};

export function BlockEditor({ pageId, content, onChange }: Props) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [revision, setRevision] = useState(0);

  const initialBlocks = useMemo(() => normalizeEditorContent(content), [content]);

  const debouncedSave = useMemo(
    () =>
      debounce((blocks: PartialBlock[]) => {
        onChangeRef.current(blocks, blocksToPlainText(blocks));
      }, 800),
    []
  );

  const uploadFile = useCallback(
    async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/pages/${pageId}/assets`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Image upload failed");
      }
      const { url } = (await res.json()) as { url: string };
      return url;
    },
    [pageId]
  );

  const editor = useCreateBlockNote(
    {
      schema: blockNoteSchema,
      initialContent: initialBlocks,
      uploadFile,
    },
    [pageId]
  );

  return (
    <div className="notion-editor min-h-[50vh] w-full">
      <BlockNoteView
        editor={editor}
        theme="dark"
        shadCNComponents={blocknoteShadCNComponents}
        onChange={() => {
          setRevision((n) => n + 1);
          debouncedSave(editor.document);
        }}
      />
      <MermaidPreviews editor={editor} revision={revision} />
    </div>
  );
}
