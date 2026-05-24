import { NextRequest, NextResponse } from "next/server";
import {
  gatewayErrorResponse,
  requireGatewayAuth,
  resolveGatewayFolderId,
} from "@/lib/gateway-auth";
import { normalizeIngestDocumentType, normalizeIngestPageContent } from "@/lib/gateway-ingest";
import { prisma } from "@/lib/prisma";
import { indexDocument, indexPage } from "@/lib/search";

type RouteParams = { params: Promise<{ libraryId: string }> };

type IngestBody = {
  kind?: "page" | "document";
  title?: string;
  content?: unknown;
  folderId?: string | null;
  pageId?: string;
  documentId?: string;
  type?: string;
  language?: string;
};

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { libraryId } = await params;
    const { userId } = await requireGatewayAuth(req, libraryId);
    const body = (await req.json()) as IngestBody;

    const kind = body.kind ?? "page";
    const folderId = await resolveGatewayFolderId(userId, libraryId, body.folderId);

    if (kind === "document") {
      const content =
        typeof body.content === "string"
          ? body.content
          : body.content
            ? JSON.stringify(body.content)
            : "";

      if (body.documentId) {
        const existing = await prisma.document.findFirst({
          where: { id: body.documentId, userId, libraryId },
        });
        if (!existing) {
          return NextResponse.json({ error: "Document not found" }, { status: 404 });
        }

        const document = await prisma.document.update({
          where: { id: existing.id },
          data: {
            ...(body.title !== undefined && { title: body.title.trim() || existing.title }),
            ...(body.content !== undefined && { content }),
            ...(body.folderId !== undefined && { folderId }),
            ...(body.language !== undefined && { language: body.language }),
          },
        });

        await indexDocument(document.id, document.title, document.content).catch(() => {});
        return NextResponse.json({ kind: "document", item: document, updated: true });
      }

      const document = await prisma.document.create({
        data: {
          title: body.title?.trim() || "Untitled",
          type: normalizeIngestDocumentType(body.type),
          content,
          language: body.language ?? null,
          userId,
          libraryId,
          folderId,
        },
      });

      await indexDocument(document.id, document.title, document.content).catch(() => {});
      return NextResponse.json({ kind: "document", item: document, created: true }, { status: 201 });
    }

    const { blocks, plainText } = normalizeIngestPageContent(body.content);

    if (body.pageId) {
      const existing = await prisma.page.findFirst({
        where: { id: body.pageId, userId, libraryId },
      });
      if (!existing) {
        return NextResponse.json({ error: "Page not found" }, { status: 404 });
      }

      const page = await prisma.page.update({
        where: { id: existing.id },
        data: {
          ...(body.title !== undefined && { title: body.title.trim() || "Untitled" }),
          ...(body.content !== undefined && { content: blocks as object, plainText }),
          ...(body.folderId !== undefined && { folderId }),
        },
      });

      await indexPage(page.id, page.title, page.plainText).catch(() => {});
      return NextResponse.json({ kind: "page", item: page, updated: true });
    }

    const page = await prisma.page.create({
      data: {
        title: body.title?.trim() || "Untitled",
        content: blocks as object,
        plainText,
        userId,
        libraryId,
        folderId,
      },
    });

    await indexPage(page.id, page.title, page.plainText).catch(() => {});
    return NextResponse.json({ kind: "page", item: page, created: true }, { status: 201 });
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
