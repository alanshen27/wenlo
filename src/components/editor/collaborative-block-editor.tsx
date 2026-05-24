"use client";

import { useCreateBlockNote } from "@blocknote/react";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/shadcn/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BlockNoteEditor } from "@blocknote/core";
import type * as Y from "yjs";
import { BlockNoteEditorView } from "@/components/editor/blocknote-editor-view";
import { useRepairYjsUndo } from "@/hooks/use-repair-yjs-undo";
import { YJS_FRAGMENT } from "@/lib/collab/config";
import {
  loadOrSeedYjsDoc,
  type PusherYjsProvider,
} from "@/lib/collab/pusher-yjs-provider";
import { blockNoteSchema } from "@/lib/blocknote-schema";
import { blocksToPlainText } from "@/lib/editor-content";
import { apiUpload, getApiErrorMessage } from "@/lib/api";
import { debounce } from "@/lib/utils";

type Props = {
  pageId: string;
  doc: Y.Doc;
  provider: PusherYjsProvider;
  user: { name: string; color: string };
  readOnly?: boolean;
  onChange: (content: unknown, plainText: string) => void;
  onLocalEdit?: () => void;
};

export function CollaborativeBlockEditor(props: Props) {
  const [yjsReady, setYjsReady] = useState(false);

  useEffect(() => {
    setYjsReady(false);
    let cancelled = false;

    void loadOrSeedYjsDoc(props.doc, props.pageId)
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
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
        Loading document…
      </div>
    );
  }

  return <CollaborativeBlockEditorMounted {...props} />;
}

function CollaborativeBlockEditorMounted({
  pageId,
  doc,
  provider,
  user,
  readOnly = false,
  onChange,
  onLocalEdit,
}: Props) {
  const onChangeRef = useRef(onChange);
  const onLocalEditRef = useRef(onLocalEdit);
  onChangeRef.current = onChange;
  onLocalEditRef.current = onLocalEdit;

  const fragment = doc.getXmlFragment(YJS_FRAGMENT);

  const debouncedSave = useMemo(
    () =>
      debounce((editor: BlockNoteEditor) => {
        const blocks = editor.document;
        onChangeRef.current(blocks, blocksToPlainText(blocks));
      }, 1200),
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

  // Create the editor only after Yjs state is in the fragment (y-prosemirror order).
  const editor = useCreateBlockNote(
    {
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
    return () => {
      const current = editorRef.current;
      if (current) {
        const blocks = current.document;
        onChangeRef.current(blocks, blocksToPlainText(blocks));
      }
    };
  }, []);

  return (
    <div className="notion-editor min-h-[50vh] w-full">
      <BlockNoteEditorView
        editor={editor}
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
