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
  /** Card thumbnail tint + accent stripe. */
  accent?: string;
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
        accent: t.accent,
        preview: t.preview,
      }));
    case "slides":
      return PRESENTATION_TEMPLATES.map((t) => ({
        id: t.id,
        label: t.label,
        title: t.title,
        accent: t.accent,
      }));
    case "whiteboards":
      return BOARD_TEMPLATES.map((t) => ({
        id: t.id,
        label: t.label,
        title: t.title,
        accent: t.accent,
      }));
    case "flowcharts":
      return FLOW_TEMPLATES.map((t) => ({
        id: t.id,
        label: t.label,
        title: t.title,
        accent: t.accent,
      }));
    case "databases":
      return DATABASE_TEMPLATES.map((t) => ({
        id: t.id,
        label: t.label,
        title: t.title,
        accent: t.accent,
        preview: t.preview,
      }));
    default:
      return [];
  }
}
