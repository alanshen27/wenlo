import { DocumentType } from "@prisma/client";

async function extractPdfText(buffer: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

export async function extractTextFromFile(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<{ content: string; type: DocumentType; language?: string }> {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  if (mimeType === "application/pdf" || ext === "pdf") {
    const content = await extractPdfText(buffer);
    return { content, type: "PDF" };
  }

  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === "docx"
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return { content: result.value, type: "DOC" };
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    ext === "pptx"
  ) {
    // Basic fallback — full pptx parsing would need a dedicated lib
    return { content: `[Slides uploaded: ${filename}]`, type: "SLIDES" };
  }

  const codeExts: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    py: "python",
    rs: "rust",
    go: "go",
    java: "java",
    cpp: "cpp",
    c: "c",
    h: "c",
    md: "markdown",
  };

  if (codeExts[ext] || mimeType.startsWith("text/")) {
    const content = buffer.toString("utf-8");
    const language = codeExts[ext];
    return {
      content,
      type: language ? "CODE" : ext === "md" || ext === "txt" ? "NOTE" : "OTHER",
      language,
    };
  }

  return { content: buffer.toString("utf-8"), type: "OTHER" };
}

export function inferDocumentType(filename: string, mimeType: string): DocumentType {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf" || mimeType === "application/pdf") return "PDF";
  if (ext === "pptx" || ext === "ppt") return "SLIDES";
  if (ext === "docx" || ext === "doc") return "DOC";
  if (["ts", "tsx", "js", "jsx", "py", "rs", "go", "java", "cpp", "c", "h"].includes(ext))
    return "CODE";
  if (["md", "txt"].includes(ext)) return "NOTE";
  return "OTHER";
}
