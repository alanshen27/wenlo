import { NextRequest, NextResponse } from "next/server";
import {
  gatewayErrorResponse,
  requireGatewayAuth,
  resolveGatewayFolderId,
} from "@/lib/auth/gateway-auth";
import { prisma } from "@/lib/db/prisma";

type RouteParams = { params: Promise<{ libraryId: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { libraryId } = await params;
    const { userId } = await requireGatewayAuth(req, libraryId);
    const sp = req.nextUrl.searchParams;

    const type = sp.get("type") ?? "all";
    const folderIdParam = sp.get("folderId");
    const pageId = sp.get("pageId");
    const documentId = sp.get("documentId");
    const limit = Math.min(Number(sp.get("limit") ?? 50), 200);

    if (pageId) {
      const page = await prisma.page.findFirst({ where: { id: pageId, userId, libraryId } });
      if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });
      return NextResponse.json({ kind: "page", item: page });
    }

    if (documentId) {
      const document = await prisma.document.findFirst({
        where: { id: documentId, userId, libraryId },
      });
      if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });
      return NextResponse.json({ kind: "document", item: document });
    }

    const folderFilter =
      folderIdParam === null
        ? {}
        : { folderId: await resolveGatewayFolderId(userId, libraryId, folderIdParam) };

    const [pages, documents, folders, library] = await Promise.all([
      type === "documents"
        ? Promise.resolve([])
        : prisma.page.findMany({
            where: { userId, libraryId, ...folderFilter },
            orderBy: { updatedAt: "desc" },
            take: limit,
          }),
      type === "pages"
        ? Promise.resolve([])
        : prisma.document.findMany({
            where: { userId, libraryId, ...folderFilter },
            orderBy: { updatedAt: "desc" },
            take: limit,
          }),
      prisma.folder.findMany({
        where: { userId, libraryId },
        orderBy: { name: "asc" },
        select: { id: true, name: true, color: true, parentId: true, updatedAt: true },
      }),
      prisma.library.findFirst({
        where: { id: libraryId, userId },
        select: { id: true, name: true, icon: true, updatedAt: true },
      }),
    ]);

    if (!library) {
      return NextResponse.json({ error: "Library not found" }, { status: 404 });
    }

    return NextResponse.json({
      library,
      folders,
      pages,
      documents,
      filter: folderIdParam ? { folderId: folderFilter.folderId ?? null } : null,
      count: { pages: pages.length, documents: documents.length, folders: folders.length },
    });
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
