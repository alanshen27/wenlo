import type { NativeKind } from "@/lib/native/native-types";
import { PAGE_TEMPLATES } from "@/lib/native/page-templates";
import { PRESENTATION_TEMPLATES } from "@/lib/decks/presentation-templates";
import { BOARD_TEMPLATES } from "@/lib/native/board-templates";
import { FLOW_TEMPLATES } from "@/lib/native/flow-templates";
import { DATABASE_TEMPLATES } from "@/lib/native/database-templates";

/** A starter layout shown on the native home "Create new" row. */
export type NativeTemplateEntry = {
  id: string;
  label: string;
  title: string;
  /** Plain-text excerpt for doc/database card thumbnails. */
  preview?: string;
};

export function listNativeTemplates(kind: NativeKind): NativeTemplateEntry[] {
  switch (kind) {
    case "docs":
      return PAGE_TEMPLATES.map((t) => ({
        id: t.id,
        label: t.label,
        title: t.title,
        preview: t.preview,
      }));
    case "slides":
      return PRESENTATION_TEMPLATES.map((t) => ({
        id: t.id,
        label: t.label,
        title: t.title,
      }));
    case "whiteboards":
      return BOARD_TEMPLATES.map((t) => ({
        id: t.id,
        label: t.label,
        title: t.title,
      }));
    case "flowcharts":
      return FLOW_TEMPLATES.map((t) => ({
        id: t.id,
        label: t.label,
        title: t.title,
      }));
    case "databases":
      return DATABASE_TEMPLATES.map((t) => ({
        id: t.id,
        label: t.label,
        title: t.title,
      }));
    default:
      return [];
  }
}
