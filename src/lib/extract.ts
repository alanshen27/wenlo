import type OpenAI from "openai";
import { DocumentType } from "@/generated/prisma/client";
import { getOpenAI, OPENAI_MODELS } from "@/lib/openai";

export type ExtractResult = {
  content: string;
  type: DocumentType;
  language?: string;
  /**
   * True when native extraction couldn't produce good text (images, scanned
   * PDFs, unknown binaries) and the file is a candidate for OpenAI
   * vision/file processing in the background.
   */
  aiEligible?: boolean;
};

const IMAGE_EXTS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "bmp",
  "tif",
  "tiff",
  "heic",
  "svg",
]);

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

const OPENAI_EXTRACTION_PROMPT =
  "You are an OCR and document-understanding engine. Extract ALL readable text " +
  "from this file verbatim, preserving reading order. If it is an image, chart, " +
  "or diagram, also append a concise description of the visual content (objects, " +
  "tables, layout, data) so it can be found via search. Respond with plain text " +
  "only — no preamble and no markdown code fences.";

/**
 * Extract searchable text from a file using an OpenAI vision/file model.
 * Handles images (transcription + description) and documents like PDFs that
 * native parsing can't read (e.g. scanned pages). Returns "" on any failure so
 * callers can fall back to whatever native content they already have.
 */
export async function extractWithOpenAI(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<string> {
  const openai = getOpenAI();
  const dataUrl = `data:${mimeType || "application/octet-stream"};base64,${buffer.toString("base64")}`;
  const isImage = mimeType.startsWith("image/") || IMAGE_EXTS.has(filename.split(".").pop()?.toLowerCase() ?? "");

  const content = isImage
    ? [
        { type: "input_text", text: OPENAI_EXTRACTION_PROMPT },
        { type: "input_image", image_url: dataUrl, detail: "auto" },
      ]
    : [
        { type: "input_text", text: OPENAI_EXTRACTION_PROMPT },
        { type: "input_file", filename, file_data: dataUrl },
      ];

  const res = await openai.responses.create({
    model: OPENAI_MODELS.fileProcessing,
    input: [{ role: "user", content }],
  } as OpenAI.Responses.ResponseCreateParamsNonStreaming);

  return res.output_text ?? "";
}

export async function extractTextFromFile(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<ExtractResult> {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  const result = await extractRaw(buffer, mimeType, filename, ext);
  return { ...result, content: sanitizeText(result.content) };
}

async function extractRaw(
  buffer: Buffer,
  mimeType: string,
  filename: string,
  ext: string
): Promise<ExtractResult> {
  if (mimeType.startsWith("image/") || IMAGE_EXTS.has(ext)) {
    // Real text comes from the OpenAI pass in the background job.
    return { content: `[Image: ${filename}]`, type: "OTHER", aiEligible: true };
  }

  if (mimeType === "application/pdf" || ext === "pdf") {
    const content = await extractPdfText(buffer);
    // Scanned / image-only PDFs yield little or no extractable text — flag them
    // for OpenAI processing.
    const aiEligible = content.replace(/\s/g, "").length < 16;
    return {
      content: aiEligible ? `[PDF: ${filename}]` : content,
      type: "PDF",
      aiEligible,
    };
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

  // Unknown / binary file: don't persist mis-decoded bytes. Leave a placeholder
  // and let the OpenAI file pass try to read it in the background.
  return { content: `[File: ${filename}]`, type: "OTHER", aiEligible: true };
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
