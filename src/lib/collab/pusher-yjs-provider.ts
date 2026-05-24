"use client";

import * as Y from "yjs";
import PusherClient, { type Channel } from "pusher-js";
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
import { collabPageChannel, YJS_ORIGIN_REMOTE } from "@/lib/collab/config";
import { base64ToUint8, uint8ToBase64 } from "@/lib/collab/encoding";
import type { PageCollaborator } from "@/lib/page-presence";
import { apiGet, apiPostSilent } from "@/lib/api";

export type CollabUser = {
  id: string;
  name: string;
  color: string;
};

type AwarenessUser = {
  user?: { id?: string; name?: string; color?: string };
};

const FLUSH_MS = 40;

export class PusherYjsProvider {
  readonly awareness: Awareness;
  readonly doc: Y.Doc;
  onTitle?: (title: string) => void;
  onCollaboratorsChange?: (collaborators: PageCollaborator[]) => void;

  private pageId: string;
  private pusher: PusherClient | null = null;
  private channel: Channel | null = null;
  private destroyed = false;
  private pendingDocUpdates: Uint8Array[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(doc: Y.Doc, pageId: string, user: CollabUser) {
    this.doc = doc;
    this.pageId = pageId;
    this.awareness = new Awareness(doc);
    this.awareness.setLocalStateField("user", {
      id: user.id,
      name: user.name,
      color: user.color,
    });

    this.doc.on("update", this.handleDocUpdate);
    this.awareness.on("update", this.handleAwarenessUpdate);
    this.awareness.on("change", this.emitCollaborators);

    void this.connect();
  }

  private handleDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (this.destroyed || origin === YJS_ORIGIN_REMOTE) return;

    if (origin instanceof Y.UndoManager) {
      this.flushPendingNow();
      void this.postUpdate(update);
      return;
    }

    this.pendingDocUpdates.push(update);
    this.scheduleFlush();
  };

  private scheduleFlush() {
    if (this.flushTimer !== null) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flushPendingNow();
    }, FLUSH_MS);
  }

  private flushPendingNow() {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.destroyed || this.pendingDocUpdates.length === 0) return;
    const merged = Y.mergeUpdates(this.pendingDocUpdates);
    this.pendingDocUpdates = [];
    void this.postUpdate(merged);
  }

  private handleAwarenessUpdate = (
    change: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown
  ) => {
    if (this.destroyed || origin === this) return;
    const changed = change.added.concat(change.updated, change.removed);
    const encoded = encodeAwarenessUpdate(this.awareness, changed);
    void this.postAwareness(encoded);
  };

  private emitCollaborators = () => {
    if (!this.onCollaboratorsChange || this.destroyed) return;
    const seen = new Set<string>();
    const collaborators: PageCollaborator[] = [];
    this.awareness.getStates().forEach((state, clientId) => {
      if (clientId === this.doc.clientID) return;
      const user = (state as AwarenessUser).user;
      if (!user?.name) return;
      const userId = user.id ?? String(clientId);
      if (seen.has(userId)) return;
      seen.add(userId);
      collaborators.push({
        userId,
        name: user.name,
        email: user.name,
      });
    });

    const callback = this.onCollaboratorsChange;
    queueMicrotask(() => {
      if (!this.destroyed) callback(collaborators);
    });
  };

  private async connect() {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!key || !cluster) return;

    this.pusher = new PusherClient(key, {
      cluster,
      authEndpoint: "/api/pusher/auth",
    });

    this.channel = this.pusher.subscribe(collabPageChannel(this.pageId));
    this.channel.bind("yjs:update", (payload: { update: string; originClientId?: number }) => {
      if (
        payload.originClientId !== undefined &&
        payload.originClientId === this.doc.clientID
      ) {
        return;
      }
      Y.applyUpdate(this.doc, base64ToUint8(payload.update), YJS_ORIGIN_REMOTE);
    });
    this.channel.bind("yjs:awareness", (payload: { update: string }) => {
      applyAwarenessUpdate(this.awareness, base64ToUint8(payload.update), this);
    });
    this.channel.bind("yjs:title", (payload: { title: string }) => {
      this.onTitle?.(payload.title);
    });
  }

  private async postUpdate(update: Uint8Array) {
    await apiPostSilent(`/api/pages/${this.pageId}/yjs`, {
      update: uint8ToBase64(update),
      clientId: this.doc.clientID,
    });
  }

  private async postAwareness(update: Uint8Array) {
    await apiPostSilent(`/api/pages/${this.pageId}/yjs`, {
      awareness: uint8ToBase64(update),
    });
  }

  broadcastTitle(title: string) {
    void apiPostSilent(`/api/pages/${this.pageId}/yjs/title`, { title });
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;

    this.flushPendingNow();

    removeAwarenessStates(this.awareness, [this.doc.clientID], this);
    this.awareness.destroy();
    this.doc.off("update", this.handleDocUpdate);
    this.awareness.off("update", this.handleAwarenessUpdate);
    this.awareness.off("change", this.emitCollaborators);

    if (this.channel) {
      this.channel.unbind_all();
      this.pusher?.unsubscribe(collabPageChannel(this.pageId));
    }
    this.pusher?.disconnect();
  }
}

export async function loadOrSeedYjsDoc(doc: Y.Doc, pageId: string): Promise<void> {
  let data: { state: string | null };
  try {
    data = await apiGet<{ state: string | null }>(`/api/pages/${pageId}/yjs`);
  } catch {
    throw new Error("Failed to load collaborative document");
  }

  if (data.state) {
    Y.applyUpdate(doc, base64ToUint8(data.state), YJS_ORIGIN_REMOTE);
  }
}
