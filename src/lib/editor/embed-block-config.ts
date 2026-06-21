import { createBlockSpec } from "@blocknote/core";

/** Document types that can be embedded inside a page. */
export type NativeEmbedKind = "DECK" | "DATABASE" | "FLOWCHART";

export const nativeEmbedBlockConfig = {
  type: "nativeEmbed",
  propSchema: {
    embedKind: { default: "DECK" as NativeEmbedKind },
    documentId: { default: "" },
    libraryId: { default: "" },
    title: { default: "Untitled" },
    /** DATABASE only — which saved view to render. */
    viewId: { default: "" },
  },
  content: "none",
} as const;

/** Server-safe block spec so Yjs seeding keeps embed blocks in page JSON. */
export const nativeEmbedServerSpec = createBlockSpec(nativeEmbedBlockConfig, {
  render: () => {
    const dom = document.createElement("div");
    dom.className = "bn-native-embed";
    dom.setAttribute("data-native-embed", "true");
    return { dom };
  },
});
