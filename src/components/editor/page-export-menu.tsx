"use client";

import { useState, type RefObject } from "react";
import {
  Check,
  Copy,
  Download,
  FileCode2,
  FileText,
  FileType2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { RecallEditor } from "@/lib/editor/blocknote-schema";
import {
  downloadBlob,
  downloadTextFile,
  editorToDocxBlob,
  editorToHtmlDocument,
  editorToMarkdown,
  editorToPdfBlob,
  slugifyFilename,
} from "@/lib/editor/editor-export";

type Props = {
  editorRef: RefObject<RecallEditor | null>;
  title: string;
};

export function PageExportMenu({ editorRef, title }: Props) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<null | "docx" | "pdf">(null);

  const handleCopyMarkdown = async () => {
    const editor = editorRef.current;
    if (!editor) return;
    try {
      const markdown = await editorToMarkdown(editor);
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard denied or export failed — no-op */
    }
  };

  const handleDownloadMarkdown = async () => {
    const editor = editorRef.current;
    if (!editor) return;
    try {
      const markdown = await editorToMarkdown(editor);
      downloadTextFile(`${slugifyFilename(title)}.md`, markdown, "text/markdown");
    } catch {
      /* no-op */
    }
  };

  const handleDownloadHtml = async () => {
    const editor = editorRef.current;
    if (!editor) return;
    try {
      const html = await editorToHtmlDocument(editor, title);
      downloadTextFile(`${slugifyFilename(title)}.html`, html, "text/html");
    } catch {
      /* no-op */
    }
  };

  const handleDownloadDocx = async () => {
    const editor = editorRef.current;
    if (!editor || busy) return;
    setBusy("docx");
    try {
      const blob = await editorToDocxBlob(editor);
      downloadBlob(`${slugifyFilename(title)}.docx`, blob);
    } catch {
      /* export failed — no-op */
    } finally {
      setBusy(null);
    }
  };

  const handleDownloadPdf = async () => {
    const editor = editorRef.current;
    if (!editor || busy) return;
    setBusy("pdf");
    try {
      const blob = await editorToPdfBlob(editor);
      downloadBlob(`${slugifyFilename(title)}.pdf`, blob);
    } catch {
      /* export failed — no-op */
    } finally {
      setBusy(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-sm text-muted-foreground"
          />
        }
      >
        <Download className="size-4" />
        Export
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Export page</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem closeOnClick={false} onClick={() => void handleCopyMarkdown()}>
          {copied ? (
            <Check className="size-4 text-emerald-500" />
          ) : (
            <Copy className="size-4" />
          )}
          {copied ? "Copied!" : "Copy as Markdown"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void handleDownloadMarkdown()}>
          <FileText className="size-4" />
          Download .md
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void handleDownloadHtml()}>
          <FileCode2 className="size-4" />
          Download .html
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          closeOnClick={false}
          disabled={busy !== null}
          onClick={() => void handleDownloadDocx()}
        >
          {busy === "docx" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FileText className="size-4" />
          )}
          {busy === "docx" ? "Exporting…" : "Download .docx"}
        </DropdownMenuItem>
        <DropdownMenuItem
          closeOnClick={false}
          disabled={busy !== null}
          onClick={() => void handleDownloadPdf()}
        >
          {busy === "pdf" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FileType2 className="size-4" />
          )}
          {busy === "pdf" ? "Exporting…" : "Download .pdf"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
