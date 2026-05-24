"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import { useLibrary } from "@/components/library/library-shell";
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
  loading: () => (
    <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
      Loading editor…
    </div>
  ),
});

const CollaborativeBlockEditor = dynamic(
  () => import("./collaborative-block-editor").then((m) => m.CollaborativeBlockEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
        Connecting…
      </div>
    ),
  }
);

type PageEditorProps = BlockEditorProps & {
  collab?: CollabSession & { user: { name: string; color: string } };
};

export function PageEditor({ readOnly, collab, ...props }: PageEditorProps) {
  const { libraryId, tree } = useLibrary();
  const pageLink = {
    libraryId,
    tree,
    currentPageId: props.pageId,
  };

  if (collab) {
    const collabProps: CollabEditorProps = {
      pageId: props.pageId,
      pageLink,
      doc: collab.doc,
      provider: collab.provider,
      user: collab.user,
      readOnly,
      onChange: readOnly ? () => {} : props.onChange,
      onLocalEdit: readOnly ? undefined : props.onLocalEdit,
    };
    return <CollaborativeBlockEditor {...collabProps} />;
  }

  if (readOnly) {
    return (
      <BlockEditor {...props} pageLink={pageLink} onChange={() => {}} onLocalEdit={undefined} />
    );
  }

  return <BlockEditor {...props} pageLink={pageLink} />;
}
