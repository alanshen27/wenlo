"use client";

import { filterSuggestionItems } from "@blocknote/core/extensions";
import { SuggestionMenuController, useBlockNoteEditor } from "@blocknote/react";
import type {
  RecallBlockSchema,
  RecallInlineSchema,
  RecallStyleSchema,
} from "@/lib/blocknote-schema";
import { FileText } from "lucide-react";
import { useCallback } from "react";
import type { FolderNode } from "@/lib/folders";
import { flattenPagesFromTree } from "@/lib/folders";

type Props = {
  libraryId: string;
  tree: FolderNode[];
  currentPageId: string;
};

export function PageLinkMenu({ libraryId, tree, currentPageId }: Props) {
  const editor = useBlockNoteEditor<RecallBlockSchema, RecallInlineSchema, RecallStyleSchema>();

  const getItems = useCallback(
    async (query: string) => {
      const items = flattenPagesFromTree(tree)
        .filter((page) => page.id !== currentPageId)
        .map((page) => {
          const title = page.title.trim() || "Untitled";
          return {
            title,
            size: "small" as const,
            icon: <FileText className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />,
            onItemClick: () => {
              editor.insertInlineContent([
                {
                  type: "pageLink",
                  props: {
                    pageId: page.id,
                    title,
                    libraryId,
                  },
                },
                " ",
              ]);
            },
          };
        });
      return filterSuggestionItems(items, query);
    },
    [tree, currentPageId, libraryId, editor]
  );

  return <SuggestionMenuController triggerCharacter="@" getItems={getItems} />;
}
