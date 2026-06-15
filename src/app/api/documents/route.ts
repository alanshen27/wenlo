import { NextRequest, NextResponse, after } from "next/server";
import { requireUser } from "@/lib/auth/auth";
import { libraryIdFromFolder, resolveLibraryId } from "@/lib/library/libraries";
import {
  contentOwnerId,
  LibraryAccessError,
  requireLibraryAccess,
} from "@/lib/library/library-access";
import { prisma } from "@/lib/db/prisma";
import { sanitizeStorageName, uploadDocument } from "@/lib/documents/storage";
import {
  extractTextFromFile,
  extractWithOpenAI,
  inferDocumentType,
  sanitizeText,
} from "@/lib/documents/extract";
import { hasOpenAI, OPENAI_FILE_PROCESSING_ENABLED } from "@/lib/search/openai";
import { indexDocument } from "@/lib/search/search";
import { createEmptyBoard } from "@/lib/boards/board-schema";
import { createEmptyDeck } from "@/lib/decks/deck-schema";
import { createEmptyFlow } from "@/lib/flowcharts/flowchart-schema";
import { seedDatabase } from "@/lib/databases/database-server";
import type { DocumentType, Prisma } from "@/generated/prisma/client";

export async function GET(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const libraryId = await resolveLibraryId(
    user.id,
    req.nextUrl.searchParams.get("libraryId")
  );
  await requireLibraryAccess(user.id, libraryId, "VIEWER");

  const folderId = req.nextUrl.searchParams.get("folderId");

  const documents = await prisma.document.findMany({
    where: {
      libraryId,
      ...(folderId ? { folderId: folderId === "root" ? null : folderId } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(documents);
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
    where: { libraryId, folderId, title: { startsWith: base } },
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

/** Initial scene JSON for a native type (databases seed relationally instead). */
function nativeSceneData(type: DocumentType): {
  deckContent?: Prisma.InputJsonValue;
  boardContent?: Prisma.InputJsonValue;
  flowContent?: Prisma.InputJsonValue;
} {
  switch (type) {
    case "DECK":
      return { deckContent: createEmptyDeck() };
    case "WHITEBOARD":
      return { boardContent: createEmptyBoard() };
    case "FLOWCHART":
      return { flowContent: createEmptyFlow() };
    default:
      return {};
  }
}

async function createNativeDocument(req: NextRequest, userId: string) {
  const { type, title, folderId, libraryId: rawLibraryId } = await req.json();

  if (!(type in NATIVE_DEFAULT_TITLES)) {
    return NextResponse.json({ error: "Unsupported document type" }, { status: 400 });
  }
  const docType = type as DocumentType;

  try {
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

    const document = await prisma.document.create({
      data: {
        title: uniqueTitle,
        type: docType,
        status: "READY",
        content: "",
        ...nativeSceneData(docType),
        userId: ownerId,
        libraryId,
        folderId: normalizedFolderId,
      },
    });

    // Databases store their data relationally — seed a starter schema + rows.
    if (docType === "DATABASE") {
      await seedDatabase(document.id);
    }

    return NextResponse.json(document);
  } catch (error) {
    if (error instanceof LibraryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}

export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (req.headers.get("content-type")?.includes("application/json")) {
    return createNativeDocument(req, user.id);
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const folderId = formData.get("folderId") as string | null;
  const rawLibraryId = formData.get("libraryId") as string | null;
  const titleOverride = formData.get("title") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  try {
    const libraryId = await libraryIdFromFolder(
      user.id,
      folderId,
      await resolveLibraryId(user.id, rawLibraryId)
    );
    await requireLibraryAccess(user.id, libraryId, "EDITOR");
    const ownerId = await contentOwnerId(libraryId);

    const buffer = Buffer.from(await file.arrayBuffer());
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
        if (runAiPass) {
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
  } catch (error) {
    if (error instanceof LibraryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
