import { NextRequest, NextResponse, after } from "next/server";
import { badRequest, withAuth } from "@/lib/api/http";
import { libraryIdFromFolder, resolveLibraryId } from "@/lib/library/libraries";
import { contentOwnerId, requireLibraryAccess } from "@/lib/library/library-access";
import { notDeleted } from "@/lib/db/filters";
import { prisma } from "@/lib/db/prisma";
import { sanitizeStorageName, uploadDocument } from "@/lib/documents/storage";
import {
  extractTextFromFile,
  extractWithOpenAI,
  inferDocumentType,
  sanitizeText,
  transcribeAudio,
} from "@/lib/documents/extract";
import { hasOpenAI, OPENAI_FILE_PROCESSING_ENABLED } from "@/lib/search/openai";
import { indexDocument } from "@/lib/search/search";
import { createEmptyBoard, deriveBoardText, normalizeBoard } from "@/lib/boards/board-schema";
import { createEmptyDeck, deriveDeckText, normalizeDeck } from "@/lib/decks/deck-schema";
import { createEmptyFlow, deriveFlowText, normalizeFlow } from "@/lib/flowcharts/flowchart-schema";
import { reindexDatabase, seedDatabase } from "@/lib/databases/database-server";
import { assertStorageQuota } from "@/lib/billing/storage";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import type { DocumentType, Prisma } from "@/generated/prisma/client";

export async function GET(req: NextRequest) {
  return withAuth(undefined, async ({ user }) => {
    const libraryId = await resolveLibraryId(
      user.id,
      req.nextUrl.searchParams.get("libraryId")
    );
    await requireLibraryAccess(user.id, libraryId, "VIEWER");

    const folderId = req.nextUrl.searchParams.get("folderId");

    const documents = await prisma.document.findMany({
      where: {
        libraryId,
        ...notDeleted,
        ...(folderId ? { folderId: folderId === "root" ? null : folderId } : {}),
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(documents);
  });
}

// Splits a filename into its base name and extension (".pdf", ".tar.gz" stays
// as a single trailing extension — good enough for display titles).
function splitFileName(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf(".");
  if (dot > 0) return { base: name.slice(0, dot), ext: name.slice(dot) };
  return { base: name, ext: "" };
}

// Returns a title that doesn't collide with an existing document in the same
// folder, appending " (1)", " (2)", … before the extension when needed.
async function uniqueDocumentTitle(
  libraryId: string,
  folderId: string | null,
  desired: string
): Promise<string> {
  const { base, ext } = splitFileName(desired);
  const existing = await prisma.document.findMany({
    where: { libraryId, folderId, title: { startsWith: base }, ...notDeleted },
    select: { title: true },
  });
  const taken = new Set(existing.map((d) => d.title));
  if (!taken.has(desired)) return desired;
  let n = 1;
  while (taken.has(`${base} (${n})${ext}`)) n++;
  return `${base} (${n})${ext}`;
}

// Native (file-less) document types created from a JSON body rather than an
// upload: whiteboards, slideshow decks, databases, and flowcharts.
const NATIVE_DEFAULT_TITLES: Partial<Record<DocumentType, string>> = {
  WHITEBOARD: "Untitled whiteboard",
  DECK: "Untitled deck",
  DATABASE: "Untitled database",
  FLOWCHART: "Untitled flowchart",
};

/**
 * Initial scene JSON for a native type plus the plain text derived from that
 * scene, so the document can be indexed for search the moment it's created
 * (databases seed relationally instead — see `seedDatabase`/`reindexDatabase`).
 */
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

async function createNativeDocument(req: NextRequest, userId: string) {
  const {
    type,
    title,
    folderId,
    libraryId: rawLibraryId,
    deckContent,
    boardContent,
    flowContent,
    databaseTemplate,
  } = await req.json();

  if (!(type in NATIVE_DEFAULT_TITLES)) {
    throw badRequest("Unsupported document type");
  }
  const docType = type as DocumentType;

  const libraryId = await libraryIdFromFolder(
    userId,
    folderId ?? null,
    await resolveLibraryId(userId, rawLibraryId ?? null)
  );
  await requireLibraryAccess(userId, libraryId, "EDITOR");
  const ownerId = await contentOwnerId(libraryId);

  const normalizedFolderId = folderId && folderId !== "__root__" ? folderId : null;
  const desiredTitle =
    (typeof title === "string" && title.trim()) || NATIVE_DEFAULT_TITLES[docType]!;
  const uniqueTitle = await uniqueDocumentTitle(libraryId, normalizedFolderId, desiredTitle);

  let scene = nativeSceneData(docType);
  if (docType === "DECK" && deckContent != null) {
    const deck = normalizeDeck(deckContent);
    scene = { data: { deckContent: deck }, text: deriveDeckText(deck) };
  } else if (docType === "WHITEBOARD" && boardContent != null) {
    const board = normalizeBoard(boardContent);
    scene = { data: { boardContent: board }, text: deriveBoardText(board) };
  } else if (docType === "FLOWCHART" && flowContent != null) {
    const flow = normalizeFlow(flowContent);
    scene = { data: { flowContent: flow }, text: deriveFlowText(flow) };
  }

  const document = await prisma.document.create({
    data: {
      title: uniqueTitle,
      type: docType,
      status: "READY",
      content: scene.text,
      ...scene.data,
      userId: ownerId,
      libraryId,
      folderId: normalizedFolderId,
    },
  });

  // Databases store their data relationally — seed a starter schema + rows.
  if (docType === "DATABASE") {
    const template =
      typeof databaseTemplate === "string" ? databaseTemplate : undefined;
    await seedDatabase(document.id, template);
  }

  // Index native items as soon as they're created so they're discoverable in
  // recall search immediately, instead of only after their first edit.
  // Databases derive their text from the seeded rows; the other native types
  // index whatever their starter scene produced (title-only scenes are a
  // cheap no-op — empty chunks get filtered out at index time).
  after(async () => {
    try {
      if (docType === "DATABASE") {
        await reindexDatabase(document.id, userId);
      } else if (scene.text.trim()) {
        await indexDocument(document.id, document.title, scene.text, userId);
      }
    } catch (error) {
      console.error("[documents] native index failed:", error);
    }
  });

  return NextResponse.json(document);
}

export async function POST(req: NextRequest) {
  return withAuth(undefined, async ({ user }) => {
    await enforceRateLimit(user.id, user.plan, "documents:post");

    if (req.headers.get("content-type")?.includes("application/json")) {
      return createNativeDocument(req, user.id);
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folderId = formData.get("folderId") as string | null;
    const rawLibraryId = formData.get("libraryId") as string | null;
    const titleOverride = formData.get("title") as string | null;

    if (!file) throw badRequest("No file provided");

    const libraryId = await libraryIdFromFolder(
      user.id,
      folderId,
      await resolveLibraryId(user.id, rawLibraryId)
    );
    await requireLibraryAccess(user.id, libraryId, "EDITOR");

    const buffer = Buffer.from(await file.arrayBuffer());
    await assertStorageQuota(libraryId, user.plan, buffer.length);
    const ownerId = await contentOwnerId(libraryId);

    const { content, type, language, aiEligible } = await extractTextFromFile(
      buffer,
      file.type,
      file.name
    );

    const normalizedFolderId =
      folderId && folderId !== "__root__" ? folderId : null;
    const title = await uniqueDocumentTitle(
      libraryId,
      normalizedFolderId,
      titleOverride?.trim() || file.name
    );
    const docType = type === "OTHER" ? inferDocumentType(file.name, file.type) : type;

    const storagePath = await uploadDocument(
      `${ownerId}/${libraryId}/${Date.now()}-${sanitizeStorageName(file.name)}`,
      buffer,
      file.type
    ).catch((error) => {
      console.error("[documents] storage unavailable:", error);
      return null;
    });

    const document = await prisma.document.create({
      data: {
        title,
        type: docType,
        status: "PROCESSING",
        mimeType: file.type,
        storagePath,
        sizeBytes: buffer.length,
        content,
        language: language ?? null,
        userId: ownerId,
        libraryId,
        folderId: normalizedFolderId,
      },
    });

    // Process + embed/chunk in the background so the upload responds
    // immediately. The client shows a processing spinner and polls until the
    // status flips. We attempt an OpenAI vision+file pass on EVERY upload so
    // files native parsing can't read (handwriting/GoodNotes exports, scanned
    // PDFs, images, unknown binaries) still get searchable text.
    const runAiPass = OPENAI_FILE_PROCESSING_ENABLED && hasOpenAI();
    after(async () => {
      try {
        let indexedContent = document.content;
        if (docType === "AUDIO" && hasOpenAI()) {
          const transcript = sanitizeText(
            await transcribeAudio(buffer, file.name, user.id).catch(() => "")
          ).trim();
          if (transcript) indexedContent = transcript;
        } else if (runAiPass) {
          // Over-quota users skip the (expensive) AI extraction pass but the
          // document is still indexed from its native content below.
          const aiText = sanitizeText(
            await extractWithOpenAI(buffer, file.type, file.name, user.id).catch(() => "")
          ).trim();
          if (aiText) {
            // `aiEligible` means native parsing produced no real text (just a
            // placeholder), so replace it. Otherwise keep the good native text
            // and append the AI pass (image/handwriting descriptions) so we
            // enrich rather than risk truncating long extractions.
            indexedContent =
              aiEligible || !document.content.trim()
                ? aiText
                : `${document.content}\n\n${aiText}`;
            await prisma.document.update({
              where: { id: document.id },
              data: { content: indexedContent },
            });
          }
        }
        await indexDocument(document.id, document.title, indexedContent, user.id);
        await prisma.document.update({
          where: { id: document.id },
          data: { status: "READY" },
        });
      } catch {
        await prisma.document
          .update({ where: { id: document.id }, data: { status: "FAILED" } })
          .catch(() => {});
      }
    });

    return NextResponse.json(document);
  });
}
