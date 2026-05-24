"use client";

import { useCreateBlockNote } from "@blocknote/react";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/shadcn/style.css";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { BlockNoteEditorView } from "@/components/editor/blocknote-editor-view";
import { blockNoteSchema } from "@/lib/blocknote-schema";
import { blocksToPlainText, normalizeEditorContent } from "@/lib/editor-content";
import { apiUpload, getApiErrorMessage } from "@/lib/api";
import { debounce } from "@/lib/utils";
import type { PartialBlock } from "@blocknote/core";

type Props = {
  pageId: string;
  content: unknown;
  onChange: (content: unknown, plainText: string) => void;
  onLocalEdit?: () => void;
  syncedContent?: unknown;
  syncKey?: number;
};

export function BlockEditor({
  pageId,
  content,
  onChange,
  onLocalEdit,
  syncedContent,
  syncKey = 0,
}: Props) {
  const onChangeRef = useRef(onChange);
  const onLocalEditRef = useRef(onLocalEdit);
  onChangeRef.current = onChange;
  onLocalEditRef.current = onLocalEdit;
  const applyingRemoteRef = useRef(false);

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
      try {
        const { url } = await apiUpload<{ url: string }>(`/api/pages/${pageId}/assets`, form);
        return url;
      } catch (e) {
        throw new Error(getApiErrorMessage(e, "Image upload failed"));
      }
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

  useEffect(() => {
    if (!syncKey || syncedContent === undefined) return;
    applyingRemoteRef.current = true;
    const blocks = normalizeEditorContent(syncedContent);
    editor.replaceBlocks(editor.document, blocks);
    window.setTimeout(() => {
      applyingRemoteRef.current = false;
    }, 0);
  }, [syncKey, syncedContent, editor]);

  return (
    <div className="notion-editor min-h-[50vh] w-full">
      <BlockNoteEditorView
        editor={editor}
        onChange={() => {
          if (applyingRemoteRef.current) return;
          onLocalEditRef.current?.();
          debouncedSave(editor.document);
        }}
      />
    </div>
  );
}
