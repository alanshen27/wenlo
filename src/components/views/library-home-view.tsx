"use client";

import { useParams } from "next/navigation";
import { useLibrary } from "@/components/library/library-shell";
import { LibraryContentIndex } from "@/components/library/library-content-index";
import { UploadZone } from "@/components/upload/upload-zone";
import { Separator } from "@/components/ui/separator";
import { getFolderContents } from "@/lib/folders";
import { uploadFile } from "@/lib/upload";

type Props = {
  folderId?: string | null;
};

export function LibraryHomeView({ folderId: folderIdProp }: Props) {
  const params = useParams<{ folderId?: string }>();
  const folderId = folderIdProp !== undefined ? folderIdProp : (params.folderId ?? null);

  const { libraryId, activeLibrary, folders, tree, refreshTree, canEdit, uploadToFolder } =
    useLibrary();

  const selectedFolder = folderId ? folders.find((f) => f.id === folderId) : null;
  const contents = getFolderContents(tree, folderId);

  async function handleUpload(files: FileList | File[]) {
    if (uploadToFolder) {
      await uploadToFolder(folderId, files);
      return;
    }
    for (const file of Array.from(files)) {
      await uploadFile({ libraryId, folderId, file });
    }
    refreshTree();
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-8 py-16">
        <h2 className="notion-page-title mb-3">
          {selectedFolder
            ? selectedFolder.name
            : activeLibrary
              ? `${activeLibrary.icon} ${activeLibrary.name}`
              : "Home"}
        </h2>
        <p className="mb-8 text-muted-foreground">
          {selectedFolder
            ? "Files and pages in this folder. Drop uploads here or onto a folder in the sidebar."
            : "Each library is a separate knowledge base — IB notes, USACO, research, etc."}
        </p>

        {canEdit && (
          <UploadZone
            libraryId={libraryId}
            folderId={folderId}
            folderName={selectedFolder?.name ?? null}
            onUpload={handleUpload}
          />
        )}

        <LibraryContentIndex libraryId={libraryId} contents={contents} />

        <Separator className="my-8" />
        <div className="space-y-2 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Quick start</p>
          <p>• Create folders with custom colors from the sidebar</p>
          <p>• Add pages with + — type / for block commands</p>
          <p>• Use ··· menus to edit or delete items</p>
        </div>
      </div>
    </div>
  );
}
