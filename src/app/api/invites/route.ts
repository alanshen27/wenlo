import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/http";
import { listPendingInvitesForUser } from "@/lib/library/invites";

export async function GET() {
  return withAuth(undefined, async ({ user }) => {
    const invites = await listPendingInvitesForUser(user.id, user.email);
    return NextResponse.json(invites);
  });
}
