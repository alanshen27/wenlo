import {
  BlockNoteSchema,
  createCodeBlockSpec,
  defaultInlineContentSpecs,
  type BlockNoteEditor,
} from "@blocknote/core";
import { en as enLocale } from "@blocknote/core/locales";
import {
  withMultiColumn,
  multiColumnDropCursor,
  locales as multiColumnLocales,
} from "@blocknote/xl-multi-column";
import { PageLink } from "@/components/editor/page-link-inline";
import { NativeEmbed } from "@/components/editor/native-embed-block";
import { codeBlockOptions as baseCodeBlockOptions } from "@blocknote/code-block";
import { createParser } from "prosemirror-highlight/shiki";

const shikiParserSymbol = Symbol.for("blocknote.shikiParser");

const dualThemeParserOptions = {
  themes: {
    light: "github-light",
    dark: "github-dark",
  },
  defaultColor: "light" as const,
};

export const codeBlockOptions = {
  ...baseCodeBlockOptions,
  createHighlighter: () =>
    baseCodeBlockOptions.createHighlighter!().then((highlighter) => {
      (globalThis as Record<symbol, unknown>)[shikiParserSymbol] = createParser(
        highlighter,
        dualThemeParserOptions
      );
      return highlighter;
    }),
};

export const blockNoteSchema = withMultiColumn(
  BlockNoteSchema.create({
    inlineContentSpecs: {
      ...defaultInlineContentSpecs,
      pageLink: PageLink,
    },
  }).extend({
    blockSpecs: {
      codeBlock: createCodeBlockSpec(codeBlockOptions),
      nativeEmbed: NativeEmbed(),
    },
  })
);

/**
 * Shared `useCreateBlockNote` options that light up multi-column support:
 * the vertical drop cursor and the column slash-menu/dictionary entries.
 */
export const multiColumnEditorOptions = {
  dropCursor: multiColumnDropCursor,
  dictionary: {
    ...enLocale,
    multi_column: multiColumnLocales.en,
  },
} as const;

export type RecallBlockSchema = typeof blockNoteSchema.blockSchema;
export type RecallInlineSchema = typeof blockNoteSchema.inlineContentSchema;
export type RecallStyleSchema = typeof blockNoteSchema.styleSchema;

export type RecallEditor = BlockNoteEditor<
  RecallBlockSchema,
  RecallInlineSchema,
  RecallStyleSchema
>;
