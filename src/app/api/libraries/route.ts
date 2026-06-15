import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, parseBody, withAuth } from "@/lib/api/http";
import { createLibrary, listLibrariesWithRoles } from "@/lib/library/libraries";
import { DEFAULT_LIBRARY_ICON } from "@/lib/library/folder-colors";

export async function GET() {
  return withAuth(undefined, async ({ user }) => {
    const libraries = await listLibrariesWithRoles(user.id);
    return NextResponse.json(libraries);
  });
}

const createSchema = z.object({
  name: z.string().optional(),
  icon: z.string().optional(),
});

export async function POST(req: NextRequest) {
  return withAuth(undefined, async ({ user }) => {
    const { name, icon } = await parseBody(req, createSchema);
    if (!name?.trim()) throw badRequest("Name required");

    const library = await createLibrary(user.id, name.trim(), icon || DEFAULT_LIBRARY_ICON);
    return NextResponse.json({ ...library, role: "OWNER", isShared: false });
  });
}
