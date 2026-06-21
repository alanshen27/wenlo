"use client";

import { filterSuggestionItems } from "@blocknote/core/extensions";
import {
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  useBlockNoteEditor,
  type DefaultReactSuggestionItem,
} from "@blocknote/react";
import { getMultiColumnSlashMenuItems } from "@blocknote/xl-multi-column";
import { Columns3, FileText, GitBranch, Presentation } from "lucide-react";
import { useCallback } from "react";
import type {
  RecallBlockSchema,
  RecallInlineSchema,
  RecallStyleSchema,
} from "@/lib/editor/blocknote-schema";
import type { NativeEmbedKind } from "@/lib/editor/embed-block-config";
import type { RecallPartialBlock } from "@/lib/editor/editor-content";
import { flattenDocumentsFromTree, flattenPagesFromTree, type FolderNode } from "@/lib/library/folders";

type PageLinkConfig = {
  libraryId: string;
  tree: FolderNode[];
  currentPageId: string;
};

type Props = {
  pageLink?: PageLinkConfig;
};

function groupContiguously(
  items: DefaultReactSuggestionItem[]
): DefaultReactSuggestionItem[] {
  const order: string[] = [];
  const byGroup = new Map<string, DefaultReactSuggestionItem[]>();
  for (const item of items) {
    const key = item.group ?? "";
    if (!byGroup.has(key)) {
      byGroup.set(key, []);
      order.push(key);
    }
    byGroup.get(key)!.push(item);
  }
  return order.flatMap((key) => byGroup.get(key)!);
}

function insertNativeEmbed(
  editor: ReturnType<
    typeof useBlockNoteEditor<RecallBlockSchema, RecallInlineSchema, RecallStyleSchema>
  >,
  embedKind: NativeEmbedKind,
  libraryId: string,
  document: { id: string; title: string },
  viewId = ""
) {
  const cursor = editor.getTextCursorPosition();
  editor.insertBlocks(
    [
      {
        type: "nativeEmbed",
        props: {
          embedKind,
          documentId: document.id,
          libraryId,
          title: document.title.trim() || "Untitled",
          viewId,
        },
      } as RecallPartialBlock,
    ],
    cursor.block,
    "after"
  );
}

export function SlashMenu({ pageLink }: Props) {
  const editor = useBlockNoteEditor<
    RecallBlockSchema,
    RecallInlineSchema,
    RecallStyleSchema
  >();

  const getItems = useCallback(
    async (query: string): Promise<DefaultReactSuggestionItem[]> => {
      const defaultItems: DefaultReactSuggestionItem[] = [
        ...getDefaultReactSlashMenuItems(editor),
        ...getMultiColumnSlashMenuItems(editor),
      ];

      if (!pageLink) {
        return filterSuggestionItems(groupContiguously(defaultItems), query);
      }

      const pageItems: DefaultReactSuggestionItem[] = flattenPagesFromTree(pageLink.tree)
        .filter((page) => page.id !== pageLink.currentPageId)
        .map((page) => {
          const title = page.title.trim() || "Untitled";
          return {
            title,
            group: "Link to page",
            subtext: "Insert a link to this page",
            icon: <FileText className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />,
            onItemClick: () => {
              editor.insertInlineContent([
                {
                  type: "pageLink",
                  props: {
                    pageId: page.id,
                    title,
                    libraryId: pageLink.libraryId,
                  },
                },
                " ",
              ]);
            },
          } satisfies DefaultReactSuggestionItem;
        });

      const deckItems: DefaultReactSuggestionItem[] = flattenDocumentsFromTree(
        pageLink.tree,
        ["DECK"]
      ).map((doc) => {
        const title = doc.title.trim() || "Untitled";
        return {
          title,
          group: "Embed deck",
          subtext: "Embed a live deck preview",
          icon: <Presentation className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />,
          onItemClick: () => insertNativeEmbed(editor, "DECK", pageLink.libraryId, doc),
        } satisfies DefaultReactSuggestionItem;
      });

      const databaseItems: DefaultReactSuggestionItem[] = flattenDocumentsFromTree(
        pageLink.tree,
        ["DATABASE"]
      ).map((doc) => {
        const title = doc.title.trim() || "Untitled";
        return {
          title,
          group: "Embed database",
          subtext: "Embed a database view",
          icon: <Columns3 className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />,
          onItemClick: () => insertNativeEmbed(editor, "DATABASE", pageLink.libraryId, doc),
        } satisfies DefaultReactSuggestionItem;
      });

      const flowItems: DefaultReactSuggestionItem[] = flattenDocumentsFromTree(
        pageLink.tree,
        ["FLOWCHART"]
      ).map((doc) => {
        const title = doc.title.trim() || "Untitled";
        return {
          title,
          group: "Embed flowchart",
          subtext: "Embed a flowchart preview",
          icon: <GitBranch className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />,
          onItemClick: () => insertNativeEmbed(editor, "FLOWCHART", pageLink.libraryId, doc),
        } satisfies DefaultReactSuggestionItem;
      });

      const items =
        query.trim().length > 0
          ? [...defaultItems, ...pageItems, ...deckItems, ...databaseItems, ...flowItems]
          : defaultItems;

      return filterSuggestionItems(groupContiguously(items), query);
    },
    [editor, pageLink]
  );

  return <SuggestionMenuController triggerCharacter="/" getItems={getItems} />;
}
