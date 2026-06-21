import { NextRequest, NextResponse } from "next/server";
import { purgeExpiredTrash } from "@/lib/soft-delete/soft-delete";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await purgeExpiredTrash();
  return NextResponse.json({ ok: true, purged: result });
}
