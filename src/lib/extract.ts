import OpenAI, { toFile } from "openai";
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

/** Spreadsheets that are plain text and can be indexed directly. */
const TEXT_SHEET_EXTS = new Set(["csv", "tsv"]);
/** Binary spreadsheets — read via the OpenAI file pass. */
const BINARY_SHEET_EXTS = new Set(["xls", "xlsx", "ods", "numbers"]);
const ARCHIVE_EXTS = new Set(["zip", "tar", "gz", "tgz", "rar", "7z", "bz2"]);
const AUDIO_EXTS = new Set(["mp3", "wav", "m4a", "aac", "ogg", "flac", "opus"]);
const VIDEO_EXTS = new Set(["mp4", "mov", "webm", "mkv", "avi", "m4v", "wmv"]);

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
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const isImage = mimeType.startsWith("image/") || IMAGE_EXTS.has(ext);

  // Upload via the Files API and reference by id (avoids huge base64 payloads
  // and works better for large files). Images use the "vision" purpose;
  // everything else uses "user_data" for the Responses file input.
  const uploadable = await toFile(buffer, filename, {
    type: mimeType || "application/octet-stream",
  });
  const file = await openai.files.create({
    file: uploadable,
    purpose: isImage ? "vision" : "user_data",
  });

  try {
    const content = isImage
      ? [
          { type: "input_text", text: OPENAI_EXTRACTION_PROMPT },
          { type: "input_image", file_id: file.id, detail: "auto" },
        ]
      : [
          { type: "input_text", text: OPENAI_EXTRACTION_PROMPT },
          { type: "input_file", file_id: file.id },
        ];

    const res = await openai.responses.create({
      model: OPENAI_MODELS.fileProcessing,
      input: [{ role: "user", content }],
    } as OpenAI.Responses.ResponseCreateParamsNonStreaming);

    return res.output_text ?? "";
  } finally {
    // Best-effort cleanup so uploaded files don't accumulate.
    await openai.files.delete(file.id).catch(() => {});
  }
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
    return { content: `[Image: ${filename}]`, type: "IMAGE", aiEligible: true };
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

  // CSV / TSV are plain text and index directly.
  if (TEXT_SHEET_EXTS.has(ext) || mimeType === "text/csv" || mimeType === "text/tab-separated-values") {
    return { content: buffer.toString("utf-8"), type: "SHEET" };
  }

  // Binary spreadsheets — let the OpenAI file pass try to read them.
  if (BINARY_SHEET_EXTS.has(ext) || mimeType.includes("spreadsheet") || mimeType.includes("ms-excel")) {
    return { content: `[Spreadsheet: ${filename}]`, type: "SHEET", aiEligible: true };
  }

  if (ARCHIVE_EXTS.has(ext) || mimeType === "application/zip" || mimeType.includes("compressed")) {
    return { content: `[Archive: ${filename}]`, type: "ARCHIVE" };
  }

  if (AUDIO_EXTS.has(ext) || mimeType.startsWith("audio/")) {
    return { content: `[Audio: ${filename}]`, type: "AUDIO" };
  }

  if (VIDEO_EXTS.has(ext) || mimeType.startsWith("video/")) {
    return { content: `[Video: ${filename}]`, type: "VIDEO" };
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
  if (mimeType.startsWith("image/") || IMAGE_EXTS.has(ext)) return "IMAGE";
  if (TEXT_SHEET_EXTS.has(ext) || BINARY_SHEET_EXTS.has(ext) || mimeType.includes("spreadsheet"))
    return "SHEET";
  if (ARCHIVE_EXTS.has(ext)) return "ARCHIVE";
  if (AUDIO_EXTS.has(ext) || mimeType.startsWith("audio/")) return "AUDIO";
  if (VIDEO_EXTS.has(ext) || mimeType.startsWith("video/")) return "VIDEO";
  if (["ts", "tsx", "js", "jsx", "py", "rs", "go", "java", "cpp", "c", "h"].includes(ext))
    return "CODE";
  if (["md", "txt"].includes(ext)) return "NOTE";
  return "OTHER";
}
