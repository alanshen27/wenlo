"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import { useLibraryScope, useLibraryTree } from "@/components/library/context";
import { EditorBodySkeleton } from "@/components/editor/editor-skeleton";
import type { CollabSession } from "@/hooks/use-collab-session";

type BlockEditorProps = ComponentProps<
  typeof import("./block-editor").BlockEditor
> & {
  readOnly?: boolean;
};

type CollabEditorProps = ComponentProps<
  typeof import("./collaborative-block-editor").CollaborativeBlockEditor
> & {
  readOnly?: boolean;
};

const BlockEditor = dynamic(() => import("./block-editor").then((m) => m.BlockEditor), {
  ssr: false,
  loading: () => <EditorBodySkeleton />,
});

const CollaborativeBlockEditor = dynamic(
  () => import("./collaborative-block-editor").then((m) => m.CollaborativeBlockEditor),
  {
    ssr: false,
    loading: () => <EditorBodySkeleton />,
  }
);

type PageEditorProps = BlockEditorProps & {
  collab?: CollabSession & { user: { name: string; color: string } };
};

export function PageEditor({ readOnly, collab, onEditorReady, onHeadingsChange, ...props }: PageEditorProps) {
  const { libraryId } = useLibraryScope();
  const { tree } = useLibraryTree();
  const pageLink = {
    libraryId,
    tree,
    currentPageId: props.pageId,
  };

  if (collab) {
    const collabProps: CollabEditorProps = {
      pageId: props.pageId,
      baselineContent: props.content,
      pageLink,
      doc: collab.doc,
      provider: collab.provider,
      user: collab.user,
      readOnly,
      onChange: readOnly ? () => {} : props.onChange,
      onLocalEdit: readOnly ? undefined : props.onLocalEdit,
      onEditorReady,
      onHeadingsChange,
    };
    return <CollaborativeBlockEditor {...collabProps} />;
  }

  if (readOnly) {
    return (
      <BlockEditor
        {...props}
        pageLink={pageLink}
        onChange={() => {}}
        onLocalEdit={undefined}
        onEditorReady={onEditorReady}
        onHeadingsChange={onHeadingsChange}
      />
    );
  }

  return (
    <BlockEditor
      {...props}
      pageLink={pageLink}
      onEditorReady={onEditorReady}
      onHeadingsChange={onHeadingsChange}
    />
  );
}
