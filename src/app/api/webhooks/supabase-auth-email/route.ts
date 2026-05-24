import { NextResponse } from "next/server";
import {
  sendSupabaseAuthEmails,
  verifySupabaseAuthEmailPayload,
} from "@/lib/supabase-auth-email";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const payload = await req.text();
  const headers = Object.fromEntries(req.headers.entries());

  let verified;
  try {
    verified = verifySupabaseAuthEmailPayload(payload, headers);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid webhook";
    const status = message.includes("not configured") ? 503 : 401;
    return NextResponse.json({ error: message }, { status });
  }

  try {
    await sendSupabaseAuthEmails(verified);
    return NextResponse.json({});
  } catch (error) {
    console.error("[supabase-auth-email]", error);
    return NextResponse.json(
      {
        error: {
          message: error instanceof Error ? error.message : "Failed to send email",
        },
      },
      { status: 500 }
    );
  }
}
