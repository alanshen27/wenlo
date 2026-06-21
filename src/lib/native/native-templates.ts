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
  /** One-line explanation of when to use this template. */
  description: string;
  /** Plain-text excerpt for doc/database card thumbnails (fallback). */
  preview?: string;
};

export function listNativeTemplates(kind: NativeKind): NativeTemplateEntry[] {
  switch (kind) {
    case "pages":
      return PAGE_TEMPLATES.map((t) => ({
        id: t.id,
        label: t.label,
        title: t.title,
        description: t.description,
        preview: t.preview,
      }));
    case "decks":
      return PRESENTATION_TEMPLATES.map((t) => ({
        id: t.id,
        label: t.label,
        title: t.title,
        description: t.description,
      }));
    case "whiteboards":
      return BOARD_TEMPLATES.map((t) => ({
        id: t.id,
        label: t.label,
        title: t.title,
        description: t.description,
      }));
    case "flowcharts":
      return FLOW_TEMPLATES.map((t) => ({
        id: t.id,
        label: t.label,
        title: t.title,
        description: t.description,
      }));
    case "databases":
      return DATABASE_TEMPLATES.map((t) => ({
        id: t.id,
        label: t.label,
        title: t.title,
        description: t.description,
      }));
    default:
      return [];
  }
}
