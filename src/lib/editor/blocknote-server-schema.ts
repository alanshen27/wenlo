import { BlockNoteSchema } from "@blocknote/core";
import { withMultiColumn } from "@blocknote/xl-multi-column";
import { nativeEmbedServerSpec } from "@/lib/editor/embed-block-config";

/**
 * BlockNote schema for API routes — no React inline specs (e.g. pageLink).
 * `blocknote-schema.ts` pulls in client components and breaks `BlockNoteEditor.create`
 * on the server, which prevents Yjs seeding for new template pages.
 */
export const blockNoteServerSchema = withMultiColumn(
  BlockNoteSchema.create().extend({
    blockSpecs: {
      nativeEmbed: nativeEmbedServerSpec(),
    },
  })
);
