import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "@/lib/api/http";
import { requirePage } from "@/lib/pages/page-access";
import { snapshotPageBeforeUpdate } from "@/lib/pages/page-versions";
import { prisma } from "@/lib/db/prisma";
import { indexPage } from "@/lib/search/search";
import { extractPlainText } from "@/lib/editor/editor-content";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  return withAuth(ctx, async ({ params, user }) => {
    const page = await requirePage(user.id, params.id);
    return NextResponse.json(page);
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return withAuth(ctx, async ({ params, user }) => {
    const existing = await requirePage(user.id, params.id, "EDITOR");
    const { title, content, folderId } = await req.json();

    const plainText = content !== undefined ? extractPlainText(content) : existing.plainText;

    const contentChanged =
      content !== undefined && JSON.stringify(content) !== JSON.stringify(existing.content);
    const titleChanged =
      title !== undefined && (title.trim() || "Untitled") !== existing.title;

    if (contentChanged || titleChanged) {
      await snapshotPageBeforeUpdate(existing, user).catch(() => {});
    }

    const page = await prisma.page.update({
      where: { id: existing.id },
      data: {
        ...(title !== undefined && { title: title.trim() || "Untitled" }),
        ...(content !== undefined && { content, plainText }),
        ...(folderId !== undefined && {
          folderId: folderId && folderId !== "__root__" ? folderId : null,
        }),
      },
    });

    await indexPage(page.id, page.title, page.plainText, user.id).catch(() => {});

    return NextResponse.json(page);
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return withAuth(ctx, async ({ params, user }) => {
    const page = await requirePage(user.id, params.id, "EDITOR");
    await prisma.page.delete({ where: { id: page.id } });
    return NextResponse.json({ ok: true });
  });
}
