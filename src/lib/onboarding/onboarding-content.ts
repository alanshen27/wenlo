import type { RecallPartialBlock } from "@/lib/editor/editor-content";

function inline(text: string) {
  return [{ type: "text" as const, text, styles: {} }];
}

function h(level: 1 | 2, text: string): RecallPartialBlock {
  return {
    type: "heading",
    props: {
      level,
      isToggleable: false,
      backgroundColor: "default",
      textColor: "default",
      textAlignment: "left",
    },
    content: inline(text),
  };
}

function p(text: string): RecallPartialBlock {
  return {
    type: "paragraph",
    props: {
      backgroundColor: "default",
      textColor: "default",
      textAlignment: "left",
    },
    content: inline(text),
  };
}

function li(text: string): RecallPartialBlock {
  return {
    type: "bulletListItem",
    props: {
      backgroundColor: "default",
      textColor: "default",
      textAlignment: "left",
    },
    content: inline(text),
  };
}

/** First-run page seeded during onboarding — gives Recall something to cite. */
export const ONBOARDING_PAGE = {
  title: "Getting started",
  plainText: `Getting started

wenlo is your library for files and notes. Everything you add is indexed automatically so Recall can search and answer across it.

How it works
Store — upload files or write notes in your library
Index — wenlo extracts text and builds embeddings in the background
Recall — ask questions and get answers with sources`,
  content: [
    h(1, "Getting started"),
    p(
      "wenlo is your library for files and notes. Everything you add is indexed automatically so Recall can search and answer across it."
    ),
    h(2, "How it works"),
    li("Store — upload files or write notes in your library"),
    li("Index — wenlo extracts text and builds embeddings in the background"),
    li("Recall — ask questions and get answers with sources"),
  ] satisfies RecallPartialBlock[],
};

export const ONBOARDING_RECALL_PROMPT =
  "What is wenlo and how does the store → index → recall loop work?";
