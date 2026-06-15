import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/http";
import { requireDocument } from "@/lib/documents/document-access";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(ctx, async ({ params, user }) => {
    const document = await requireDocument(user.id, params.id);
    return NextResponse.json({ id: document.id, status: document.status });
  });
}
