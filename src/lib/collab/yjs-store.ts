import * as Y from "yjs";
import { YJS_FRAGMENT } from "@/lib/collab/config";
import { base64ToUint8, uint8ToBase64 } from "@/lib/collab/encoding";
import { createClient, type RedisClientType } from "redis";

let client: RedisClientType | null = null;
let connecting: Promise<RedisClientType> | null = null;

export async function getRedis() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not configured");

  if (client?.isOpen) return client;

  if (!connecting) {
    connecting = (async () => {
      const next = createClient({ url });
      next.on("error", (error) => console.error("[redis]", error));
      await next.connect();
      client = next as RedisClientType;
      return client;
    })();
  }

  return connecting;
}

function pageStateKey(pageId: string) {
  return `collab:page:${pageId}:yjs`;
}

export async function readPageYjsState(pageId: string) {
  const redis = await getRedis();
  const raw = await redis.get(pageStateKey(pageId));
  return raw ? base64ToUint8(raw) : null;
}

export async function writePageYjsState(pageId: string, state: Uint8Array) {
  const redis = await getRedis();
  await redis.set(pageStateKey(pageId), uint8ToBase64(state));
}

export async function mergePageYjsUpdate(pageId: string, update: Uint8Array) {
  const redis = await getRedis();
  const key = pageStateKey(pageId);

  // Atomic read-merge-write so concurrent editors don't overwrite each other.
  for (let attempt = 0; attempt < 8; attempt++) {
    await redis.watch(key);
    const raw = await redis.get(key);

    const doc = new Y.Doc();
    if (raw) Y.applyUpdate(doc, base64ToUint8(raw));
    Y.applyUpdate(doc, update);
    const merged = Y.encodeStateAsUpdate(doc);

    const tx = redis.multi().set(key, uint8ToBase64(merged));
    const result = await tx.exec();
    if (result) return merged;
  }

  throw new Error("Failed to merge Yjs update");
}

export async function seedPageYjsStateFromContent(pageId: string, content: unknown) {
  const existing = await readPageYjsState(pageId);
  if (existing) return existing;

  const { BlockNoteEditor } = await import("@blocknote/core");
  const { blocksToYXmlFragment } = await import("@blocknote/core/yjs");
  const { blockNoteSchema } = await import("@/lib/blocknote-schema");
  const { normalizeEditorContent } = await import("@/lib/editor-content");

  const doc = new Y.Doc();
  const tempEditor = BlockNoteEditor.create({
    schema: blockNoteSchema,
    initialContent: normalizeEditorContent(content),
  });

  blocksToYXmlFragment(tempEditor, tempEditor.document, doc.getXmlFragment(YJS_FRAGMENT));

  const state = Y.encodeStateAsUpdate(doc);
  await writePageYjsState(pageId, state);
  return state;
}

export async function overwritePageYjsFromContent(pageId: string, content: unknown) {
  const { BlockNoteEditor } = await import("@blocknote/core");
  const { blocksToYXmlFragment } = await import("@blocknote/core/yjs");
  const { blockNoteSchema } = await import("@/lib/blocknote-schema");
  const { normalizeEditorContent } = await import("@/lib/editor-content");

  const doc = new Y.Doc();
  const tempEditor = BlockNoteEditor.create({
    schema: blockNoteSchema,
    initialContent: normalizeEditorContent(content),
  });

  blocksToYXmlFragment(tempEditor, tempEditor.document, doc.getXmlFragment(YJS_FRAGMENT));

  const state = Y.encodeStateAsUpdate(doc);
  await writePageYjsState(pageId, state);
  return state;
}
