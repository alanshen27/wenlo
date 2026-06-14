"use client";

import { useCreateBlockNote } from "@blocknote/react";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/shadcn/style.css";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { BlockNoteEditorView } from "@/components/editor/blocknote-editor-view";
import { blockNoteSchema, multiColumnEditorOptions } from "@/lib/editor/blocknote-schema";
import { blocksToPlainText, normalizeEditorContent } from "@/lib/editor/editor-content";
import { apiUpload, getApiErrorMessage } from "@/lib/client/api";
import { debounce } from "@/lib/core/utils";
import type { RecallPartialBlock } from "@/lib/editor/editor-content";
import type { RecallEditor } from "@/lib/editor/blocknote-schema";
import type { FolderNode } from "@/lib/library/folders";

type Props = {
  pageId: string;
  pageLink?: {
    libraryId: string;
    tree: FolderNode[];
    currentPageId: string;
  };
  content: unknown;
  onChange: (content: unknown, plainText: string) => void;
  onLocalEdit?: () => void;
  onEditorReady?: (editor: RecallEditor | null) => void;
  syncedContent?: unknown;
  syncKey?: number;
};

export function BlockEditor({
  pageId,
  pageLink,
  content,
  onChange,
  onLocalEdit,
  onEditorReady,
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
      debounce((blocks: RecallPartialBlock[]) => {
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
      ...multiColumnEditorOptions,
      schema: blockNoteSchema,
      initialContent: initialBlocks,
      uploadFile,
    },
    [pageId]
  );

  const onEditorReadyRef = useRef(onEditorReady);
  useEffect(() => {
    onEditorReadyRef.current = onEditorReady;
  });
  useEffect(() => {
    onEditorReadyRef.current?.(editor);
    return () => onEditorReadyRef.current?.(null);
  }, [editor]);

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
        pageLink={pageLink}
        onChange={() => {
          if (applyingRemoteRef.current) return;
          onLocalEditRef.current?.();
          debouncedSave(editor.document);
        }}
      />
    </div>
  );
}
