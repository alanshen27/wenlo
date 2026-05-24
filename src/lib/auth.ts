import { prisma } from "./prisma";
import { createClient } from "./supabase/server";

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;

  return prisma.user.upsert({
    where: { email: user.email },
    update: { name: user.user_metadata?.full_name ?? undefined },
    create: {
      email: user.email,
      name: user.user_metadata?.full_name ?? null,
    },
  });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}
