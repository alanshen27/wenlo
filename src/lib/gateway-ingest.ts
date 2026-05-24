import type { PartialBlock } from "@blocknote/core";
import { extractPlainText, EMPTY_BLOCKS } from "@/lib/editor-content";

export function normalizeIngestPageContent(content: unknown): {
  blocks: PartialBlock[];
  plainText: string;
} {
  if (typeof content === "string") {
    const trimmed = content.trim();
    if (!trimmed) {
      return { blocks: EMPTY_BLOCKS, plainText: "" };
    }
    const blocks: PartialBlock[] = trimmed.split("\n").map((line) => ({
      type: "paragraph",
      content: line,
    }));
    return { blocks, plainText: trimmed };
  }

  if (Array.isArray(content)) {
    const blocks = content as PartialBlock[];
    return { blocks, plainText: extractPlainText(blocks) };
  }

  return { blocks: EMPTY_BLOCKS, plainText: "" };
}

export function normalizeIngestDocumentType(type: unknown) {
  const allowed = new Set(["NOTE", "PDF", "SLIDES", "DOC", "CODE", "OTHER"]);
  if (typeof type === "string" && allowed.has(type.toUpperCase())) {
    return type.toUpperCase() as "NOTE" | "PDF" | "SLIDES" | "DOC" | "CODE" | "OTHER";
  }
  return "NOTE" as const;
}
