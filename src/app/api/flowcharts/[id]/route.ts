import { NextRequest, NextResponse, after } from "next/server";
import { requireUser } from "@/lib/auth/auth";
import { LibraryAccessError, requireLibraryAccess } from "@/lib/library/library-access";
import { prisma } from "@/lib/db/prisma";
import { indexDocument } from "@/lib/search/search";
import {
  applyFlowPatch,
  deriveFlowText,
  normalizeFlow,
  type FlowPatch,
} from "@/lib/flowcharts/flowchart-schema";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const flow = await prisma.document.findFirst({ where: { id } });
  if (!flow || flow.type !== "FLOWCHART") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await requireLibraryAccess(user.id, flow.libraryId, "VIEWER");
  } catch (error) {
    if (error instanceof LibraryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  return NextResponse.json({
    id: flow.id,
    title: flow.title,
    folderId: flow.folderId,
    libraryId: flow.libraryId,
    scene: normalizeFlow(flow.flowContent),
    updatedAt: flow.updatedAt,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { patch?: FlowPatch } | null;
  if (!body?.patch) {
    return NextResponse.json({ error: "Missing patch" }, { status: 400 });
  }

  const existing = await prisma.document.findFirst({ where: { id } });
  if (!existing || existing.type !== "FLOWCHART") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await requireLibraryAccess(user.id, existing.libraryId, "EDITOR");
  } catch (error) {
    if (error instanceof LibraryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const merged = applyFlowPatch(normalizeFlow(existing.flowContent), body.patch);
  const derivedText = deriveFlowText(merged);

  const updated = await prisma.document.update({
    where: { id },
    data: { flowContent: merged, content: derivedText },
    select: { id: true, updatedAt: true },
  });

  after(async () => {
    try {
      await indexDocument(id, existing.title, derivedText, user.id);
    } catch (error) {
      console.error("[flowcharts] reindex failed", error);
    }
  });

  return NextResponse.json({ ok: true, updatedAt: updated.updatedAt });
}
