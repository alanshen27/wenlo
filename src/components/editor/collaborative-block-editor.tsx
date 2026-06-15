"use client";

import { useCreateBlockNote } from "@blocknote/react";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/shadcn/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BlockNoteEditor } from "@blocknote/core";
import type {
  RecallBlockSchema,
  RecallEditor,
  RecallInlineSchema,
  RecallStyleSchema,
} from "@/lib/editor/blocknote-schema";
import type * as Y from "yjs";
import { BlockNoteEditorView } from "@/components/editor/blocknote-editor-view";
import { EditorBodySkeleton } from "@/components/editor/editor-skeleton";
import { useRepairYjsUndo } from "@/hooks/use-repair-yjs-undo";
import { YJS_FRAGMENT } from "@/lib/collab/config";
import {
  loadOrSeedYjsDoc,
  type PusherYjsProvider,
} from "@/lib/collab/pusher-yjs-provider";
import { blockNoteSchema, multiColumnEditorOptions } from "@/lib/editor/blocknote-schema";
import { blocksToPlainText } from "@/lib/editor/editor-content";
import { apiUpload, getApiErrorMessage } from "@/lib/client/api";
import { debounce } from "@/lib/core/utils";
import { useEditorSaveGuard } from "@/hooks/use-editor-save-guard";
import type { FolderNode } from "@/lib/library/folders";

type Props = {
  pageId: string;
  /** Page JSON used to block mount-time autosaves from wiping templates. */
  baselineContent: unknown;
  pageLink?: {
    libraryId: string;
    tree: FolderNode[];
    currentPageId: string;
  };
  doc: Y.Doc;
  provider: PusherYjsProvider;
  user: { name: string; color: string };
  readOnly?: boolean;
  onChange: (content: unknown, plainText: string) => void;
  onLocalEdit?: () => void;
  onEditorReady?: (editor: RecallEditor | null) => void;
};

export function CollaborativeBlockEditor(props: Props) {
  const [yjsReady, setYjsReady] = useState(false);

  useEffect(() => {
    setYjsReady(false);
    let cancelled = false;

    void loadOrSeedYjsDoc(props.doc, props.pageId, props.baselineContent)
      .then(() => {
        if (!cancelled) setYjsReady(true);
      })
      .catch(() => {
        if (!cancelled) setYjsReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [props.doc, props.pageId]);

  if (!yjsReady) {
    return <EditorBodySkeleton />;
  }

  return <CollaborativeBlockEditorMounted {...props} />;
}

function CollaborativeBlockEditorMounted({
  pageId,
  baselineContent,
  pageLink,
  doc,
  provider,
  user,
  readOnly = false,
  onChange,
  onLocalEdit,
  onEditorReady,
}: Props) {
  const onChangeRef = useRef(onChange);
  const onLocalEditRef = useRef(onLocalEdit);
  const onEditorReadyRef = useRef(onEditorReady);
  onChangeRef.current = onChange;
  onLocalEditRef.current = onLocalEdit;
  useEffect(() => {
    onEditorReadyRef.current = onEditorReady;
  });

  const fragment = doc.getXmlFragment(YJS_FRAGMENT);
  const { shouldPersist, markPersisted } = useEditorSaveGuard(pageId, baselineContent);
  const shouldPersistRef = useRef(shouldPersist);
  shouldPersistRef.current = shouldPersist;

  const debouncedSave = useMemo(
    () =>
      debounce(
        (editor: BlockNoteEditor<RecallBlockSchema, RecallInlineSchema, RecallStyleSchema>) => {
          const blocks = editor.document;
          if (!shouldPersist(blocks)) return;
          markPersisted(blocks);
          onChangeRef.current(blocks, blocksToPlainText(blocks));
        },
        1200
      ),
    [shouldPersist, markPersisted]
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

  // Create the editor only after Yjs state is in the fragment (y-prosemirror order).
  const editor = useCreateBlockNote(
    {
      ...multiColumnEditorOptions,
      schema: blockNoteSchema,
      uploadFile,
      collaboration: {
        fragment,
        user,
        provider: { awareness: provider.awareness },
      },
    },
    [pageId]
  );

  const editorRef = useRef(editor);
  editorRef.current = editor;

  useRepairYjsUndo(doc, editor);

  useEffect(() => {
    onEditorReadyRef.current?.(editor);
    return () => onEditorReadyRef.current?.(null);
  }, [editor]);

  useEffect(() => {
    return () => {
      const current = editorRef.current;
      if (!current) return;
      const blocks = current.document;
      if (!shouldPersistRef.current(blocks)) return;
      onChangeRef.current(blocks, blocksToPlainText(blocks));
    };
  }, []);

  return (
    <div className="notion-editor min-h-[50vh] w-full">
      <BlockNoteEditorView
        editor={editor}
        pageLink={pageLink}
        editable={!readOnly}
        onChange={() => {
          onLocalEditRef.current?.();
          debouncedSave(editor);
        }}
      />
    </div>
  );
}

export type { PusherYjsProvider };
