import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/http";
import { deleteUserAccount } from "@/lib/account/account-data";
import { createClient } from "@/lib/supabase/server";

export async function DELETE() {
  return withAuth(undefined, async ({ user }) => {
    await deleteUserAccount(user.id);
    const supabase = await createClient();
    await supabase.auth.signOut();
    return NextResponse.json({ ok: true });
  });
}
