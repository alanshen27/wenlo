import type { RecallEditor } from "@/lib/editor/blocknote-schema";

function nativeEmbedExportLabel(props: { embedKind: string; title: string }): string {
  const name = props.title?.trim() || "Untitled";
  switch (props.embedKind) {
    case "DECK":
      return `Embedded deck: ${name}`;
    case "DATABASE":
      return `Embedded database: ${name}`;
    case "FLOWCHART":
      return `Embedded flowchart: ${name}`;
    default:
      return `Embedded content: ${name}`;
  }
}

/** Turn a page title into a safe, lowercase filename stem. */
export function slugifyFilename(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "page";
}

/** Serialize the current editor document to (lossy) Markdown. */
export async function editorToMarkdown(editor: RecallEditor): Promise<string> {
  return await editor.blocksToMarkdownLossy(editor.document);
}

/** Serialize the current editor document to a standalone HTML document. */
export async function editorToHtmlDocument(
  editor: RecallEditor,
  title: string
): Promise<string> {
  const body = await editor.blocksToHTMLLossy(editor.document);
  const safeTitle = (title.trim() || "Untitled").replace(/[<>&]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;"
  );
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safeTitle}</title>
<style>
  body { max-width: 720px; margin: 3rem auto; padding: 0 1.25rem; font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1a1a1a; }
  h1, h2, h3, h4 { line-height: 1.25; margin: 1.6em 0 0.4em; }
  pre { background: #f5f5f5; padding: 1rem; border-radius: 8px; overflow-x: auto; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.9em; }
  blockquote { border-left: 3px solid #ddd; margin: 1em 0; padding-left: 1em; color: #555; }
  img { max-width: 100%; height: auto; border-radius: 8px; }
  table { border-collapse: collapse; }
  td, th { border: 1px solid #ddd; padding: 0.4em 0.6em; }
</style>
</head>
<body>
<h1>${safeTitle}</h1>
${body}
</body>
</html>`;
}

/** Serialize the current editor document to a .docx Blob (heavy deps loaded lazily). */
export async function editorToDocxBlob(editor: RecallEditor): Promise<Blob> {
  const { DOCXExporter, docxDefaultSchemaMappings } = await import(
    "@blocknote/xl-docx-exporter"
  );
  const { TextRun, Paragraph } = await import("docx");
  const exporter = new DOCXExporter(editor.schema, {
    ...docxDefaultSchemaMappings,
    blockMapping: {
      ...docxDefaultSchemaMappings.blockMapping,
      nativeEmbed: (block) =>
        new Paragraph({
          children: [new TextRun({ text: nativeEmbedExportLabel(block.props) })],
        }),
    },
    inlineContentMapping: {
      ...docxDefaultSchemaMappings.inlineContentMapping,
      pageLink: (inlineContent) =>
        new TextRun({ text: `@${inlineContent.props.title?.trim() || "Untitled"}` }),
    },
  });
  return exporter.toBlob(editor.document);
}

/** Serialize the current editor document to a .pdf Blob (heavy deps loaded lazily). */
export async function editorToPdfBlob(editor: RecallEditor): Promise<Blob> {
  const { PDFExporter, pdfDefaultSchemaMappings } = await import(
    "@blocknote/xl-pdf-exporter"
  );
  const { pdf, Text } = await import("@react-pdf/renderer");
  const exporter = new PDFExporter(editor.schema, {
    ...pdfDefaultSchemaMappings,
    blockMapping: {
      ...pdfDefaultSchemaMappings.blockMapping,
      nativeEmbed: (block) => (
        <Text>{nativeEmbedExportLabel(block.props)}</Text>
      ),
    },
    inlineContentMapping: {
      ...pdfDefaultSchemaMappings.inlineContentMapping,
      pageLink: (inlineContent) => (
        <Text>@{inlineContent.props.title?.trim() || "Untitled"}</Text>
      ),
    },
  });
  const pdfDocument = await exporter.toReactPDFDocument(editor.document);
  return pdf(pdfDocument).toBlob();
}

/** Trigger a client-side download of a text file. */
export function downloadTextFile(filename: string, content: string, mime: string): void {
  downloadBlob(filename, new Blob([content], { type: `${mime};charset=utf-8` }));
}

/** Trigger a client-side download of an arbitrary Blob. */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
