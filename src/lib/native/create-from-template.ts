import { apiPost } from "@/lib/client/api";
import {
  createPresentationFromTemplate,
  getPresentationTemplate,
} from "@/lib/decks/presentation-templates";
import { getBoardTemplate } from "@/lib/native/board-templates";
import { getDatabaseTemplate } from "@/lib/native/database-templates";
import { getFlowTemplate } from "@/lib/native/flow-templates";
import { getPageTemplate } from "@/lib/native/page-templates";
import { NATIVE_TYPES, type NativeKind } from "@/lib/native/native-types";

/** Create a new native item from a home-page template and return its id. */
export async function createFromNativeTemplate(
  kind: NativeKind,
  templateId: string,
  libraryId: string
): Promise<string> {
  const cfg = NATIVE_TYPES[kind];

  if (cfg.source === "page") {
    const t = getPageTemplate(templateId);
    const created = await apiPost<{ id: string }>("/api/pages", {
      libraryId,
      title: t.title,
      content: t.content,
    });
    return created.id;
  }

  const body: Record<string, unknown> = {
    type: cfg.docType,
    libraryId,
  };

  switch (kind) {
    case "decks": {
      const meta = getPresentationTemplate(templateId);
      body.title = meta.title;
      body.deckContent = createPresentationFromTemplate(templateId);
      break;
    }
    case "whiteboards": {
      const t = getBoardTemplate(templateId);
      body.title = t.title;
      body.boardContent = t.build();
      break;
    }
    case "flowcharts": {
      const t = getFlowTemplate(templateId);
      body.title = t.title;
      body.flowContent = t.build();
      break;
    }
    case "databases": {
      const t = getDatabaseTemplate(templateId);
      body.title = t.title;
      body.databaseTemplate = t.id;
      break;
    }
    default:
      body.title = cfg.defaultTitle;
      break;
  }

  const created = await apiPost<{ id: string }>("/api/documents", body);
  return created.id;
}

/** Blank create (no template) — kept for the + card. */
export async function createBlankNative(kind: NativeKind, libraryId: string): Promise<string> {
  const cfg = NATIVE_TYPES[kind];
  if (cfg.source === "page") {
    const created = await apiPost<{ id: string }>("/api/pages", {
      libraryId,
      title: cfg.defaultTitle,
    });
    return created.id;
  }
  const created = await apiPost<{ id: string }>("/api/documents", {
    type: cfg.docType,
    libraryId,
    title: cfg.defaultTitle,
  });
  return created.id;
}
