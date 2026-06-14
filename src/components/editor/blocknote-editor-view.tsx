"use client";

import type { BlockSchema, InlineContentSchema, StyleSchema } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/shadcn";
import { useTheme } from "next-themes";
import type { ComponentProps, ReactNode } from "react";
import { blocknoteShadCNComponents } from "@/components/editor/blocknote-shadcn-components";
import { PageLinkLibraryProvider } from "@/components/editor/page-link-context";
import { PageLinkMenu } from "@/components/editor/page-link-menu";
import { SlashMenu } from "@/components/editor/slash-menu";
import { BlockNoteSideMenuController } from "@/components/editor/blocknote-side-menu";
import type { FolderNode } from "@/lib/folders";

type Props<
  BSchema extends BlockSchema,
  ISchema extends InlineContentSchema,
  SSchema extends StyleSchema,
> = Omit<
  ComponentProps<typeof BlockNoteView<BSchema, ISchema, SSchema>>,
  "shadCNComponents" | "sideMenu" | "theme"
> & {
  children?: ReactNode;
  pageLink?: {
    libraryId: string;
    tree: FolderNode[];
    currentPageId: string;
  };
};

export function BlockNoteEditorView<
  BSchema extends BlockSchema,
  ISchema extends InlineContentSchema,
  SSchema extends StyleSchema,
>({ children, pageLink, editable, ...props }: Props<BSchema, ISchema, SSchema>) {
  const { resolvedTheme } = useTheme();
  const editingEnabled = editable !== false;
  const showPageLinkMenu = editingEnabled && pageLink != null;

  return (
    <PageLinkLibraryProvider libraryId={pageLink?.libraryId ?? ""}>
      <BlockNoteView
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        sideMenu={false}
        slashMenu={false}
        shadCNComponents={blocknoteShadCNComponents}
        editable={editable}
        {...props}
      >
        {editingEnabled && <SlashMenu pageLink={pageLink} />}
        {showPageLinkMenu && (
          <PageLinkMenu
            libraryId={pageLink.libraryId}
            tree={pageLink.tree}
            currentPageId={pageLink.currentPageId}
          />
        )}
        <BlockNoteSideMenuController />
        {children}
      </BlockNoteView>
    </PageLinkLibraryProvider>
  );
}
