import { NextResponse, after, type NextRequest } from "next/server";
import { badRequest, withAuth } from "@/lib/api/http";
import { requireDocument } from "@/lib/documents/document-access";
import { prisma } from "@/lib/db/prisma";
import { indexDocument } from "@/lib/search/search";
import {
  applyFlowPatch,
  deriveFlowText,
  normalizeFlow,
  type FlowPatch,
} from "@/lib/flowcharts/flowchart-schema";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  return withAuth(ctx, async ({ params, user }) => {
    const flow = await requireDocument(user.id, params.id, { type: "FLOWCHART" });
    return NextResponse.json({
      id: flow.id,
      title: flow.title,
      folderId: flow.folderId,
      libraryId: flow.libraryId,
      scene: normalizeFlow(flow.flowContent),
      updatedAt: flow.updatedAt,
    });
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return withAuth(ctx, async ({ params, user }) => {
    const existing = await requireDocument(user.id, params.id, {
      type: "FLOWCHART",
      role: "EDITOR",
    });

    const body = (await req.json().catch(() => null)) as { patch?: FlowPatch } | null;
    if (!body?.patch) throw badRequest("Missing patch");

    const merged = applyFlowPatch(normalizeFlow(existing.flowContent), body.patch);
    const derivedText = deriveFlowText(merged);

    const updated = await prisma.document.update({
      where: { id: existing.id },
      data: { flowContent: merged, content: derivedText },
      select: { id: true, updatedAt: true },
    });

    after(async () => {
      try {
        await indexDocument(existing.id, existing.title, derivedText, user.id);
      } catch (error) {
        console.error("[flowcharts] reindex failed", error);
      }
    });

    return NextResponse.json({ ok: true, updatedAt: updated.updatedAt });
  });
}
