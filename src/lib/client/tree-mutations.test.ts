import { describe, expect, it } from "vitest";
import type { FolderNode } from "@/lib/library/folders";
import {
  addOptimisticDocuments,
  findItemInTree,
  moveItemInTree,
  removeOptimisticDocument,
  replaceOptimisticDocument,
  setDocumentProcessing,
  setDocumentStatus,
} from "./tree-mutations";

function sampleTree(): FolderNode[] {
  return [
    {
      id: "folder-a",
      name: "Folder A",
      color: "blue",
      parentId: null,
      children: [],
      pages: [{ id: "page-1", title: "Page One" }],
      documents: [{ id: "doc-1", title: "Doc One", type: "PDF" }],
    },
    {
      id: "__root__",
      name: "Library",
      color: "gray",
      parentId: null,
      children: [],
      pages: [],
      documents: [],
    },
  ];
}

describe("findItemInTree", () => {
  it("finds pages and documents with folder id", () => {
    const tree = sampleTree();
    expect(findItemInTree(tree, { kind: "page", id: "page-1" })).toEqual({
      title: "Page One",
      folderId: "folder-a",
    });
    expect(findItemInTree(tree, { kind: "document", id: "doc-1" })).toEqual({
      title: "Doc One",
      type: "PDF",
      folderId: "folder-a",
    });
  });
});

describe("moveItemInTree", () => {
  it("moves a page into root", () => {
    const tree = sampleTree();
    const next = moveItemInTree(
      tree,
      { kind: "page", id: "page-1", title: "Page One" },
      null
    );
    const root = next.find((n) => n.id === "__root__")!;
    expect(root.pages).toContainEqual({ id: "page-1", title: "Page One" });
    expect(next.find((n) => n.id === "folder-a")!.pages).toHaveLength(0);
  });

  it("returns original tree when target folder is missing", () => {
    const tree = sampleTree();
    const next = moveItemInTree(
      tree,
      { kind: "document", id: "doc-1", title: "Doc One", type: "PDF" },
      "missing-folder"
    );
    expect(next).toEqual(tree);
  });
});

describe("optimistic document helpers", () => {
  it("adds, replaces, and removes optimistic uploads", () => {
    let tree = sampleTree();
    tree = addOptimisticDocuments(
      tree,
      [{ id: "pending:1", title: "upload.pdf", type: "PDF", pending: true }],
      "folder-a"
    );
    expect(
      tree.find((n) => n.id === "folder-a")!.documents[0]
    ).toMatchObject({ id: "pending:1", pending: true });

    tree = replaceOptimisticDocument(tree, "pending:1", {
      id: "doc-real",
      title: "upload.pdf",
      type: "PDF",
      processing: true,
      status: "PROCESSING",
    });
    expect(tree.find((n) => n.id === "folder-a")!.documents[0]).toMatchObject({
      id: "doc-real",
      processing: true,
      status: "PROCESSING",
    });

    tree = removeOptimisticDocument(tree, "doc-real");
    expect(tree.find((n) => n.id === "folder-a")!.documents).toHaveLength(1);
  });

  it("toggles processing and status flags", () => {
    let tree = sampleTree();
    tree = setDocumentProcessing(tree, "doc-1", true);
    expect(tree.find((n) => n.id === "folder-a")!.documents[0].processing).toBe(true);

    tree = setDocumentStatus(tree, "doc-1", "READY");
    const doc = tree.find((n) => n.id === "folder-a")!.documents[0];
    expect(doc.status).toBe("READY");
    expect(doc.processing).toBe(false);
  });
});
