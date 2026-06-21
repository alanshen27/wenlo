import type { DocumentType, Prisma } from "@/generated/prisma/client";
import { createEmptyBoard, deriveBoardText } from "@/lib/boards/board-schema";
import { isCollabConfigured } from "@/lib/collab/config";
import { seedPageYjsStateFromContent } from "@/lib/collab/yjs-store";
import { reindexDatabase, seedDatabase } from "@/lib/databases/database-server";
import { createEmptyDeck, deriveDeckText } from "@/lib/decks/deck-schema";
import { EMPTY_BLOCKS, extractPlainText, plainTextToBlocks } from "@/lib/editor/editor-content";
import { createEmptyFlow, deriveFlowText } from "@/lib/flowcharts/flowchart-schema";
import { libraryIdFromFolder } from "@/lib/library/libraries";
import { contentOwnerId, requireLibraryAccess } from "@/lib/library/library-access";
import { NATIVE_TYPES, type NativeKind } from "@/lib/native/native-types";
import { prisma } from "@/lib/db/prisma";
import { indexDocument, indexPage } from "@/lib/search/search";

export const LIBRARY_ITEM_KINDS = [
  "note",
  "page",
  "whiteboard",
  "deck",
  "database",
  "flowchart",
] as const;

export type LibraryItemKind = (typeof LIBRARY_ITEM_KINDS)[number];

const KIND_TO_NATIVE: Record<Exclude<LibraryItemKind, "note">, NativeKind> = {
  page: "pages",
  whiteboard: "whiteboards",
  deck: "decks",
  database: "databases",
  flowchart: "flowcharts",
};

const NATIVE_DEFAULT_TITLES: Partial<Record<DocumentType, string>> = {
  WHITEBOARD: "Untitled whiteboard",
  DECK: "Untitled deck",
  DATABASE: "Untitled database",
  FLOWCHART: "Untitled flowchart",
};

export type CreateLibraryItemInput = {
  userId: string;
  libraryId: string;
  kind: LibraryItemKind;
  title?: string;
  folderId?: string | null;
  content?: string;
  databaseTemplate?: string;
};

export type CreateLibraryItemResult = {
  id: string;
  kind: LibraryItemKind;
  title: string;
  libraryId: string;
  folderId: string | null;
  sourceType: "page" | "document";
};

function splitFileName(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf(".");
  if (dot > 0) return { base: name.slice(0, dot), ext: name.slice(dot) };
  return { base: name, ext: "" };
}

async function uniqueDocumentTitle(
  libraryId: string,
  folderId: string | null,
  desired: string
): Promise<string> {
  const { base, ext } = splitFileName(desired);
  const existing = await prisma.document.findMany({
    where: { libraryId, folderId, title: { startsWith: base } },
    select: { title: true },
  });
  const taken = new Set(existing.map((d) => d.title));
  if (!taken.has(desired)) return desired;
  let n = 1;
  while (taken.has(`${base} (${n})${ext}`)) n++;
  return `${base} (${n})${ext}`;
}

function nativeSceneData(type: DocumentType): {
  data: {
    deckContent?: Prisma.InputJsonValue;
    boardContent?: Prisma.InputJsonValue;
    flowContent?: Prisma.InputJsonValue;
  };
  text: string;
} {
  switch (type) {
    case "DECK": {
      const deck = createEmptyDeck();
      return { data: { deckContent: deck }, text: deriveDeckText(deck) };
    }
    case "WHITEBOARD": {
      const board = createEmptyBoard();
      return { data: { boardContent: board }, text: deriveBoardText(board) };
    }
    case "FLOWCHART": {
      const flow = createEmptyFlow();
      return { data: { flowContent: flow }, text: deriveFlowText(flow) };
    }
    default:
      return { data: {}, text: "" };
  }
}

async function resolveCreateContext(
  userId: string,
  libraryId: string,
  folderId?: string | null
) {
  const resolvedLibraryId = await libraryIdFromFolder(userId, folderId ?? null, libraryId);
  await requireLibraryAccess(userId, resolvedLibraryId, "EDITOR");
  const ownerId = await contentOwnerId(resolvedLibraryId);
  const normalizedFolderId = folderId && folderId !== "root" && folderId !== "__root__" ? folderId : null;
  return { resolvedLibraryId, ownerId, normalizedFolderId };
}

/** Create a library item (note, page, or native document type). Requires EDITOR access. */
export async function createLibraryItem(
  input: CreateLibraryItemInput
): Promise<CreateLibraryItemResult> {
  const { userId, kind, content, databaseTemplate } = input;
  const { resolvedLibraryId, ownerId, normalizedFolderId } = await resolveCreateContext(
    userId,
    input.libraryId,
    input.folderId
  );

  if (kind === "note") {
    const body = (content ?? "").trim();
    const title = input.title?.trim() || "Untitled note";
    const document = await prisma.document.create({
      data: {
        title,
        type: "NOTE",
        status: "READY",
        content: body,
        userId: ownerId,
        libraryId: resolvedLibraryId,
        folderId: normalizedFolderId,
      },
    });
    if (body) await indexDocument(document.id, document.title, body, userId);
    return {
      id: document.id,
      kind,
      title: document.title,
      libraryId: resolvedLibraryId,
      folderId: document.folderId,
      sourceType: "document",
    };
  }

  if (kind === "page") {
    const blocks = content ? plainTextToBlocks(content) : EMPTY_BLOCKS;
    const title = input.title?.trim() || NATIVE_TYPES.pages.defaultTitle;
    const page = await prisma.page.create({
      data: {
        title,
        userId: ownerId,
        libraryId: resolvedLibraryId,
        folderId: normalizedFolderId,
        content: blocks as Prisma.InputJsonValue,
        plainText: extractPlainText(blocks),
      },
    });
    await indexPage(page.id, page.title, page.plainText, userId).catch(() => {});
    if (isCollabConfigured() && blocks !== EMPTY_BLOCKS) {
      await seedPageYjsStateFromContent(page.id, blocks).catch(() => {});
    }
    return {
      id: page.id,
      kind,
      title: page.title,
      libraryId: resolvedLibraryId,
      folderId: page.folderId,
      sourceType: "page",
    };
  }

  const nativeKind = KIND_TO_NATIVE[kind];
  const cfg = NATIVE_TYPES[nativeKind];
  const docType = cfg.docType;
  if (!docType) throw new Error(`Unsupported kind: ${kind}`);

  const desiredTitle =
    input.title?.trim() || NATIVE_DEFAULT_TITLES[docType] || cfg.defaultTitle;
  const uniqueTitle = await uniqueDocumentTitle(
    resolvedLibraryId,
    normalizedFolderId,
    desiredTitle
  );
  const scene = nativeSceneData(docType);

  const document = await prisma.document.create({
    data: {
      title: uniqueTitle,
      type: docType,
      status: "READY",
      content: scene.text,
      ...scene.data,
      userId: ownerId,
      libraryId: resolvedLibraryId,
      folderId: normalizedFolderId,
    },
  });

  if (docType === "DATABASE") {
    const template = typeof databaseTemplate === "string" ? databaseTemplate : undefined;
    await seedDatabase(document.id, template);
    await reindexDatabase(document.id, userId).catch(() => {});
  } else if (scene.text.trim()) {
    await indexDocument(document.id, document.title, scene.text, userId).catch(() => {});
  }

  return {
    id: document.id,
    kind,
    title: document.title,
    libraryId: resolvedLibraryId,
    folderId: document.folderId,
    sourceType: "document",
  };
}
