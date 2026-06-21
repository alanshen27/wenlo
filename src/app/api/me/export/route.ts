import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/http";
import { exportUserData } from "@/lib/account/account-data";

export async function GET() {
  return withAuth(undefined, async ({ user }) => {
    const buffer = await exportUserData(user.id);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="wenlo-export-${user.id}.zip"`,
      },
    });
  });
}
