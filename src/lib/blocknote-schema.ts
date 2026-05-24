import { BlockNoteSchema, createCodeBlockSpec } from "@blocknote/core";
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

export const blockNoteSchema = BlockNoteSchema.create().extend({
  blockSpecs: {
    codeBlock: createCodeBlockSpec(codeBlockOptions),
  },
});
