import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { LibraryAccessError, requireLibraryAccess } from "@/lib/library-access";
import { prisma } from "@/lib/prisma";
import { listPendingInvitesForUser } from "@/lib/invites";

export async function GET() {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const invites = await listPendingInvitesForUser(user.id, user.email);
  return NextResponse.json(invites);
}
