import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/auth";
import { createLibrary, listLibrariesWithRoles } from "@/lib/library/libraries";
import { DEFAULT_LIBRARY_ICON } from "@/lib/library/folder-colors";

export async function GET() {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const libraries = await listLibrariesWithRoles(user.id);
  return NextResponse.json(libraries);
}

export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, icon } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }

  const library = await createLibrary(user.id, name.trim(), icon || DEFAULT_LIBRARY_ICON);
  return NextResponse.json({ ...library, role: "OWNER", isShared: false });
}
