import type { PartialBlock } from "@blocknote/core";
import type { RecallBlockSchema, RecallInlineSchema, RecallStyleSchema } from "@/lib/blocknote-schema";

export type RecallPartialBlock = PartialBlock<
  RecallBlockSchema,
  RecallInlineSchema,
  RecallStyleSchema
>;

export const EMPTY_BLOCKS: RecallPartialBlock[] = [{ type: "paragraph" }];

export function normalizeEditorContent(content: unknown): RecallPartialBlock[] {
  if (Array.isArray(content) && content.length > 0) {
    const first = content[0];
    if (first && typeof first === "object" && "type" in first && typeof first.type === "string") {
      return content as RecallPartialBlock[];
    }
  }

  if (
    content &&
    typeof content === "object" &&
    "type" in content &&
    (content as { type: string }).type === "doc" &&
    "content" in content &&
    Array.isArray((content as { content: unknown[] }).content)
  ) {
    const text = extractTipTapPlainText((content as { content: unknown[] }).content);
    if (text.trim()) {
      return [{ type: "paragraph", content: text.trim() }];
    }
  }

  return EMPTY_BLOCKS;
}

function extractTipTapPlainText(nodes: unknown[]): string {
  const parts: string[] = [];
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    const n = node as { type?: string; text?: string; content?: unknown[] };
    if (n.text) parts.push(n.text);
    if (n.content) parts.push(extractTipTapPlainText(n.content));
  }
  return parts.join(" ");
}

export function blocksToPlainText(blocks: RecallPartialBlock[]): string {
  const lines: string[] = [];

  function inlineText(content: unknown): string {
    if (!Array.isArray(content)) return "";
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "type" in item) {
          const typed = item as { type?: string; props?: { title?: string }; text?: string };
          if (typed.type === "pageLink") {
            const title = typed.props?.title?.trim() || "Untitled";
            return `@${title}`;
          }
          if ("text" in typed && typed.text != null) {
            return String(typed.text);
          }
        }
        return "";
      })
      .join("");
  }

  function walk(blockList: RecallPartialBlock[]) {
    for (const block of blockList) {
      if (block.type === "image") {
        const props = block.props as { name?: string; caption?: string } | undefined;
        const label = props?.caption || props?.name;
        if (label) lines.push(`[image: ${label}]`);
      } else if (block.type === "codeBlock") {
        if (block.content) lines.push(inlineText(block.content));
      } else if (block.content) {
        lines.push(inlineText(block.content));
      }
      if (block.children?.length) walk(block.children);
    }
  }

  walk(blocks);
  return lines.filter(Boolean).join("\n");
}

export function extractPlainText(content: unknown): string {
  return blocksToPlainText(normalizeEditorContent(content));
}
