import { apiDelete, apiPost } from "@/lib/client/api";

export type PinTarget = { pageId: string } | { documentId: string };

/** Pin or unpin a page/document for the current user. */
export async function setPin(target: PinTarget, pinned: boolean): Promise<void> {
  if (pinned) {
    await apiPost("/api/pins", target);
  } else {
    await apiDelete("/api/pins", { data: target });
  }
}

/** Map a native item type to its pin target (PAGE items are pages). */
export function pinTargetForItem(type: string, id: string): PinTarget {
  return type === "PAGE" ? { pageId: id } : { documentId: id };
}
