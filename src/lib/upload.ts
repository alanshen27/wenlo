import { apiUpload, getApiErrorMessage } from "@/lib/api";

export type DocumentStatus = "PROCESSING" | "READY" | "FAILED";

export type UploadedDocument = {
  id: string;
  title: string;
  type: string;
  status: DocumentStatus;
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
  let document: { id: string; title: string; type: string; status?: DocumentStatus };
  try {
    document = await apiUpload<{ id: string; title: string; type: string; status?: DocumentStatus }>(
      "/api/documents",
      form
    );
  } catch (e) {
    throw new Error(getApiErrorMessage(e, "Upload failed"));
  }
  return {
    id: document.id,
    title: document.title,
    type: document.type,
    status: document.status ?? "READY",
  };
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
