export type UploadedDocument = {
  id: string;
  title: string;
  type: string;
};

export async function uploadFile(opts: {
  libraryId: string;
  folderId: string | null;
  file: File;
}): Promise<UploadedDocument> {
  const { libraryId, folderId, file } = opts;
  const form = new FormData();
  form.append("file", file);
  form.append("libraryId", libraryId);
  if (folderId) form.append("folderId", folderId);
  const res = await fetch("/api/documents", { method: "POST", body: form });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Upload failed");
  }
  const document = await res.json();
  return { id: document.id, title: document.title, type: document.type };
}

export async function uploadFiles(opts: {
  libraryId: string;
  folderId: string | null;
  files: FileList | File[];
  onFileUploaded?: (document: UploadedDocument) => void;
}) {
  const { libraryId, folderId, files, onFileUploaded } = opts;

  for (const file of Array.from(files)) {
    const document = await uploadFile({ libraryId, folderId, file });
    onFileUploaded?.(document);
  }
}
