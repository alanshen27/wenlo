"use client";

import { filterSuggestionItems } from "@blocknote/core/extensions";
import {
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  useBlockNoteEditor,
  type DefaultReactSuggestionItem,
} from "@blocknote/react";
import { getMultiColumnSlashMenuItems } from "@blocknote/xl-multi-column";
import { FileText } from "lucide-react";
import { useCallback } from "react";
import type {
  RecallBlockSchema,
  RecallInlineSchema,
  RecallStyleSchema,
} from "@/lib/editor/blocknote-schema";
import { flattenPagesFromTree, type FolderNode } from "@/lib/library/folders";

type PageLinkConfig = {
  libraryId: string;
  tree: FolderNode[];
  currentPageId: string;
};

type Props = {
  pageLink?: PageLinkConfig;
};

/**
 * Reorders items so all items sharing a `group` are contiguous (preserving the
 * order each group first appears). The default suggestion menu keys group
 * sections by their label, so non-contiguous duplicates (e.g. multi-column
 * items appended after the built-in "Basic blocks" group) would otherwise warn
 * about duplicate React keys.
 */
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

/**
 * Replacement for BlockNote's default `/` menu: keeps every built-in block item
 * and adds a "Link to page" group so pages can be linked without the `@` trigger.
 */
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

      const pageItems: DefaultReactSuggestionItem[] = pageLink
        ? flattenPagesFromTree(pageLink.tree)
            .filter((page) => page.id !== pageLink.currentPageId)
            .map((page) => {
              const title = page.title.trim() || "Untitled";
              return {
                title,
                group: "Link to page",
                subtext: "Insert a link to this page",
                icon: (
                  <FileText
                    className="size-4 shrink-0 text-muted-foreground"
                    strokeWidth={2}
                  />
                ),
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
            })
        : [];

      // Only surface page links once the user is actually searching, so the
      // default menu stays compact when first opened.
      const items =
        query.trim().length > 0 ? [...defaultItems, ...pageItems] : defaultItems;

      return filterSuggestionItems(groupContiguously(items), query);
    },
    [editor, pageLink]
  );

  return <SuggestionMenuController triggerCharacter="/" getItems={getItems} />;
}
