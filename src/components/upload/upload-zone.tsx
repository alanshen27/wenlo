"use client";

import { useCallback, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { uploadFile } from "@/lib/upload";

type Props = {
  libraryId: string | null;
  folderId: string | null;
  folderName?: string | null;
  onUploaded?: () => void;
  onUpload?: (files: FileList | File[]) => void | Promise<void>;
};

export function UploadZone({
  libraryId,
  folderId,
  folderName,
  onUploaded,
  onUpload,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (files: FileList | File[]) => {
      if (onUpload) {
        setUploading(true);
        setError(null);
        try {
          await onUpload(files);
          onUploaded?.();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Upload failed");
        } finally {
          setUploading(false);
        }
        return;
      }

      if (!libraryId) return;
      setUploading(true);
      setError(null);
      try {
        for (const file of Array.from(files)) {
          await uploadFile({ libraryId, folderId, file });
        }
        onUploaded?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [libraryId, folderId, onUpload, onUploaded]
  );

  return (
    <div
      className={cn(
        "rounded-lg border border-dashed p-8 text-center transition-colors",
        dragging ? "border-primary bg-primary/5" : "border-border bg-muted/30"
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length) upload(e.dataTransfer.files);
      }}
    >
      <Upload className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
      <p className="mb-1 text-sm">
        {folderName
          ? `Drop files into ${folderName}`
          : "Drop notes, PDFs, slides, docs, or code snippets"}
      </p>
      <p className="mb-4 text-xs text-muted-foreground">.pdf .docx .md .txt .ts .py and more</p>
      <Button
        type="button"
        variant="secondary"
        disabled={uploading || !libraryId}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? "Uploading…" : "Choose files"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        disabled={uploading}
        onChange={(e) => e.target.files && upload(e.target.files)}
      />
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </div>
  );
}
