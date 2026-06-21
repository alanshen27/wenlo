import type { SceneElement } from "@/lib/scene/elements";

export const SCENE_VERSION = 2 as const;

export type SceneDoc = {
  version: typeof SCENE_VERSION;
  elementOrder: string[];
  elements: Record<string, SceneElement>;
};

export type ScenePatch = {
  upserts?: Record<string, SceneElement>;
  deletes?: string[];
  elementOrder?: string[];
};

export function newSceneId(prefix = "el"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function createEmptyScene(): SceneDoc {
  return { version: SCENE_VERSION, elementOrder: [], elements: {} };
}

/** Coerces unknown JSON into a valid, well-ordered SceneDoc. */
export function normalizeScene(input: unknown): SceneDoc {
  if (!input || typeof input !== "object") return createEmptyScene();
  const raw = input as Partial<SceneDoc>;
  const elements: Record<string, SceneElement> =
    raw.elements && typeof raw.elements === "object"
      ? (raw.elements as Record<string, SceneElement>)
      : {};

  const order = Array.isArray(raw.elementOrder)
    ? raw.elementOrder.filter((id) => id in elements)
    : [];
  for (const id of Object.keys(elements)) {
    if (!order.includes(id)) order.push(id);
  }

  return { version: SCENE_VERSION, elementOrder: order, elements };
}

export function applyScenePatch(scene: SceneDoc, patch: ScenePatch): SceneDoc {
  const elements: Record<string, SceneElement> = { ...scene.elements };

  if (patch.upserts) {
    for (const [id, el] of Object.entries(patch.upserts)) {
      elements[id] = { ...el, id };
    }
  }
  if (patch.deletes) {
    for (const id of patch.deletes) delete elements[id];
  }

  let order: string[];
  if (patch.elementOrder) {
    order = patch.elementOrder.filter((id) => id in elements);
    for (const id of Object.keys(elements)) {
      if (!order.includes(id)) order.push(id);
    }
  } else {
    order = scene.elementOrder.filter((id) => id in elements);
    if (patch.upserts) {
      for (const id of Object.keys(patch.upserts)) {
        if (id in elements && !order.includes(id)) order.push(id);
      }
    }
  }

  return { version: SCENE_VERSION, elementOrder: order, elements };
}

/** Concatenated searchable text from text-like elements. */
export function deriveSceneText(scene: SceneDoc): string {
  const parts: string[] = [];
  for (const id of scene.elementOrder) {
    const el = scene.elements[id];
    if (!el) continue;
    if (el.type === "text" || el.type === "sticky") {
      const text = el.text?.trim();
      if (text) parts.push(text);
    }
  }
  return parts.join("\n");
}
