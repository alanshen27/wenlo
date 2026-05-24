import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { libraryIdFromFolder, resolveLibraryId } from "@/lib/libraries";
import {
  contentOwnerId,
  LibraryAccessError,
  requireLibraryAccess,
} from "@/lib/library-access";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractTextFromFile, inferDocumentType } from "@/lib/extract";
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
    const { content, type, language } = await extractTextFromFile(
      buffer,
      file.type,
      file.name
    );

    const title = titleOverride?.trim() || file.name;
    const docType = type === "OTHER" ? inferDocumentType(file.name, file.type) : type;

    let storagePath: string | null = null;
    try {
      const supabase = createAdminClient();
      const path = `${ownerId}/${libraryId}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("documents").upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      });
      if (!error) storagePath = path;
    } catch {
      // Storage optional for dev
    }

    const document = await prisma.document.create({
      data: {
        title,
        type: docType,
        mimeType: file.type,
        storagePath,
        content,
        language: language ?? null,
        userId: ownerId,
        libraryId,
        folderId: folderId && folderId !== "__root__" ? folderId : null,
      },
    });

    await indexDocument(document.id, document.title, document.content).catch(() => {});

    return NextResponse.json(document);
  } catch (error) {
    if (error instanceof LibraryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
