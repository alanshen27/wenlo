import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db/prisma";
import { notDeleted } from "@/lib/db/filters";
import type { ShareAccess } from "@/generated/prisma/client";

export function generateShareToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashSharePassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifySharePassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, "hex");
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

export async function setPageShare(
  pageId: string,
  access: ShareAccess,
  password?: string | null
) {
  const shareToken = access === "NONE" ? null : generateShareToken();
  return prisma.page.update({
    where: { id: pageId },
    data: {
      shareAccess: access,
      shareToken,
      sharePasswordHash:
        access !== "NONE" && password?.trim()
          ? hashSharePassword(password.trim())
          : null,
    },
    select: { shareToken: true, shareAccess: true },
  });
}

export async function setDocumentShare(
  documentId: string,
  access: ShareAccess,
  password?: string | null
) {
  const shareToken = access === "NONE" ? null : generateShareToken();
  return prisma.document.update({
    where: { id: documentId },
    data: {
      shareAccess: access,
      shareToken,
      sharePasswordHash:
        access !== "NONE" && password?.trim()
          ? hashSharePassword(password.trim())
          : null,
    },
    select: { shareToken: true, shareAccess: true },
  });
}

export async function resolveShareByToken(token: string) {
  const [page, document] = await Promise.all([
    prisma.page.findFirst({
      where: { shareToken: token, shareAccess: { not: "NONE" }, ...notDeleted },
    }),
    prisma.document.findFirst({
      where: { shareToken: token, shareAccess: { not: "NONE" }, ...notDeleted },
    }),
  ]);
  if (page) return { type: "page" as const, item: page };
  if (document) return { type: "document" as const, item: document };
  return null;
}
