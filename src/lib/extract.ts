import { DocumentType } from "@prisma/client";

/**
 * Postgres `text` columns reject NUL bytes (0x00), which binary-ish extractions
 * (PDFs, mis-decoded files) can produce. Strip them plus other lone control
 * characters so the content is always safe to persist.
 */
export function sanitizeText(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\u0000/g, "").replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

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

  const result = await extractRaw(buffer, mimeType, filename, ext);
  return { ...result, content: sanitizeText(result.content) };
}

async function extractRaw(
  buffer: Buffer,
  mimeType: string,
  filename: string,
  ext: string
): Promise<{ content: string; type: DocumentType; language?: string }> {
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
