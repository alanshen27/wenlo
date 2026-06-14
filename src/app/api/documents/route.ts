import { NextRequest, NextResponse, after } from "next/server";
import { requireUser } from "@/lib/auth";
import { libraryIdFromFolder, resolveLibraryId } from "@/lib/libraries";
import {
  contentOwnerId,
  LibraryAccessError,
  requireLibraryAccess,
} from "@/lib/library-access";
import { prisma } from "@/lib/prisma";
import { sanitizeStorageName, uploadDocument } from "@/lib/storage";
import {
  extractTextFromFile,
  extractWithOpenAI,
  inferDocumentType,
  sanitizeText,
} from "@/lib/extract";
import { hasOpenAI, OPENAI_FILE_PROCESSING_ENABLED } from "@/lib/openai";
import { indexDocument } from "@/lib/search";

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

export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    // status flips. For images / scanned PDFs / unknown files we first run an
    // OpenAI vision+file pass to produce searchable text.
    const runAiPass = Boolean(aiEligible) && OPENAI_FILE_PROCESSING_ENABLED && hasOpenAI();
    after(async () => {
      try {
        let indexedContent = document.content;
        if (runAiPass) {
          const aiText = sanitizeText(
            await extractWithOpenAI(buffer, file.type, file.name)
          ).trim();
          if (aiText) {
            indexedContent = aiText;
            await prisma.document.update({
              where: { id: document.id },
              data: { content: aiText },
            });
          }
        }
        await indexDocument(document.id, document.title, indexedContent);
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
