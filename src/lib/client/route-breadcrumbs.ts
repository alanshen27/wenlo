import { buildBreadcrumbs, type BreadcrumbItem } from "@/lib/library/folders";
import { findItemInTree } from "@/lib/client/tree-mutations";

type FlatFolder = { id: string; name: string; color: string; parentId: string | null };

type RouteParams = {
  folderId?: string;
  pageId?: string;
  documentId?: string;
};

type Options = {
  titleOverride?: string;
  folderIdFallback?: string | null;
};

export function buildRouteBreadcrumbs(
  params: RouteParams,
  library: {
    libraryName: string;
    folders: FlatFolder[];
    tree: Parameters<typeof findItemInTree>[0];
  },
  opts?: Options
): BreadcrumbItem[] {
  const { libraryName, folders, tree } = library;

  if (params.pageId) {
    const inTree = findItemInTree(tree, { type: "page", id: params.pageId });
    const folderId = inTree?.folderId ?? opts?.folderIdFallback ?? null;
    const name = opts?.titleOverride ?? inTree?.title ?? "Untitled";
    return buildBreadcrumbs({
      libraryName,
      folders,
      folderId,
      currentItem: { id: params.pageId, name, type: "page" },
    });
  }

  if (params.documentId) {
    const inTree = findItemInTree(tree, { type: "document", id: params.documentId });
    const folderId = inTree?.folderId ?? opts?.folderIdFallback ?? null;
    const name = opts?.titleOverride ?? inTree?.title ?? "Untitled";
    return buildBreadcrumbs({
      libraryName,
      folders,
      folderId,
      currentItem: { id: params.documentId, name, type: "document" },
    });
  }

  const folderId = params.folderId ?? opts?.folderIdFallback ?? null;
  return buildBreadcrumbs({ libraryName, folders, folderId });
}
