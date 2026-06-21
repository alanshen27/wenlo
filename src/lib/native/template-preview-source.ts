import type { ItemPreviewSource } from "@/components/cloud/item-previews";
import { presentationThumbnailSlide } from "@/lib/decks/presentation-templates";
import { getBoardTemplate } from "@/lib/native/board-templates";
import {
  buildDatabaseTemplatePreviewScene,
  type DatabaseTemplateId,
} from "@/lib/native/database-templates";
import { getFlowTemplate } from "@/lib/native/flow-templates";
import { getPageTemplate } from "@/lib/native/page-templates";
import type { NativeTemplateEntry } from "@/lib/native/native-templates";
import type { NativeKind } from "@/lib/native/native-types";

/** Preview source for a native-home template card (matches recents routing). */
export function templateItemPreviewSource(
  kind: NativeKind,
  template: NativeTemplateEntry
): ItemPreviewSource {
  switch (kind) {
    case "pages":
      return {
        mode: "page-blocks",
        title: template.title,
        blocks: getPageTemplate(template.id).content,
      };
    case "decks":
      return { mode: "deck", slide: presentationThumbnailSlide(template.id) };
    case "whiteboards":
      return { mode: "board", scene: getBoardTemplate(template.id).build() };
    case "flowcharts":
      return { mode: "flow", scene: getFlowTemplate(template.id).build() };
    case "databases":
      return {
        mode: "database",
        scene: buildDatabaseTemplatePreviewScene(template.id as DatabaseTemplateId),
      };
    case "pdfs":
      return { mode: "file", type: "PDF" };
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}
