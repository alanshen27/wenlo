import { extractPlainText, EMPTY_BLOCKS, type RecallPartialBlock } from "@/lib/editor/editor-content";

export function normalizeIngestPageContent(content: unknown): {
  blocks: RecallPartialBlock[];
  plainText: string;
} {
  if (typeof content === "string") {
    const trimmed = content.trim();
    if (!trimmed) {
      return { blocks: EMPTY_BLOCKS, plainText: "" };
    }
    const blocks: RecallPartialBlock[] = trimmed.split("\n").map((line) => ({
      type: "paragraph",
      content: line,
    }));
    return { blocks, plainText: trimmed };
  }

  if (Array.isArray(content)) {
    const blocks = content as RecallPartialBlock[];
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
