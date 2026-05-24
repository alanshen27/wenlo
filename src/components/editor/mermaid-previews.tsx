"use client";

import { useEffect, useRef } from "react";
import type { BlockNoteEditor } from "@blocknote/core";
import { renderMermaidDiagram } from "@/lib/mermaid-render";
import { debounce } from "@/lib/utils";

type Props = {
  editor: BlockNoteEditor;
  revision: number;
};

function syncMermaidPreviews(root: HTMLElement) {
  const codeBlocks = root.querySelectorAll<HTMLElement>(
    '.bn-block-content[data-content-type="codeBlock"]'
  );

  codeBlocks.forEach((contentEl) => {
    const language = contentEl.querySelector("select")?.value;
    const blockOuter = contentEl.closest<HTMLElement>(".bn-block-outer");
    const blockId = blockOuter?.getAttribute("data-id") ?? crypto.randomUUID();
    let preview = blockOuter?.querySelector<HTMLElement>(".recall-mermaid-preview");

    if (language !== "mermaid") {
      preview?.remove();
      return;
    }

    if (!preview && blockOuter) {
      preview = document.createElement("div");
      preview.className = "recall-mermaid-preview";
      preview.contentEditable = "false";
      blockOuter.appendChild(preview);
    }

    if (!preview) return;

    const code = contentEl.querySelector("pre code")?.textContent ?? "";
    void renderMermaidDiagram(preview, code, blockId);
  });
}

export function MermaidPreviews({ editor, revision }: Props) {
  const debouncedSync = useRef(
    debounce(() => {
      const root = document.querySelector<HTMLElement>(".notion-editor");
      if (root) syncMermaidPreviews(root);
    }, 350)
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      debouncedSync.current();
    });
    return () => cancelAnimationFrame(frame);
  }, [editor, revision]);

  return null;
}
