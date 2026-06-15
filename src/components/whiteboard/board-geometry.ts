import type { BoardElement, ConnectorElement } from "@/lib/boards/board-schema";

export type Box = { x: number; y: number; w: number; h: number };

/** Local (pre-translation) bounding box of an element, ignoring rotation. */
export function localBounds(el: BoardElement): Box {
  // Connectors are positioned by their endpoints (absolute), not x/y.
  if (el.type === "connector") return { x: 0, y: 0, w: 0, h: 0 };
  if (el.type === "path" || el.type === "arrow") {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < el.points.length; i += 2) {
      xs.push(el.points[i]);
      ys.push(el.points[i + 1]);
    }
    const minX = Math.min(0, ...xs);
    const minY = Math.min(0, ...ys);
    const maxX = Math.max(0, ...xs);
    const maxY = Math.max(0, ...ys);
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
  if (el.type === "text") {
    return { x: 0, y: 0, w: el.w, h: el.fontSize * 1.4 };
  }
  return { x: 0, y: 0, w: el.w, h: el.h };
}

/** Absolute (translated) bounding box of an element, ignoring rotation. */
export function absBounds(el: BoardElement): Box {
  const lb = localBounds(el);
  return { x: el.x + lb.x, y: el.y + lb.y, w: lb.w, h: lb.h };
}

/** An alignment guide to render while dragging. */
export type SnapLine = { axis: "x" | "y"; pos: number; from: number; to: number };
export type SnapResult = { dx: number; dy: number; lines: SnapLine[] };

/**
 * Smart-snapping: nudge `moving` so its edges/centers align with any `others`'
 * edges/centers within `threshold` (scene units). Returns the offset to apply
 * plus the guide lines to draw. Picks the closest candidate per axis.
 */
export function computeSnap(moving: Box, others: Box[], threshold: number): SnapResult {
  const movX = [moving.x, moving.x + moving.w / 2, moving.x + moving.w];
  const movY = [moving.y, moving.y + moving.h / 2, moving.y + moving.h];

  let bestX: { dx: number; diff: number; pos: number; other: Box } | null = null;
  let bestY: { dy: number; diff: number; pos: number; other: Box } | null = null;

  for (const o of others) {
    const targX = [o.x, o.x + o.w / 2, o.x + o.w];
    const targY = [o.y, o.y + o.h / 2, o.y + o.h];

    for (const m of movX) {
      for (const t of targX) {
        const diff = Math.abs(t - m);
        if (diff <= threshold && (!bestX || diff < bestX.diff)) {
          bestX = { dx: t - m, diff, pos: t, other: o };
        }
      }
    }
    for (const m of movY) {
      for (const t of targY) {
        const diff = Math.abs(t - m);
        if (diff <= threshold && (!bestY || diff < bestY.diff)) {
          bestY = { dy: t - m, diff, pos: t, other: o };
        }
      }
    }
  }

  const dx = bestX?.dx ?? 0;
  const dy = bestY?.dy ?? 0;
  const lines: SnapLine[] = [];

  if (bestX) {
    const snapped = { ...moving, x: moving.x + dx };
    lines.push({
      axis: "x",
      pos: bestX.pos,
      from: Math.min(snapped.y, bestX.other.y),
      to: Math.max(snapped.y + snapped.h, bestX.other.y + bestX.other.h),
    });
  }
  if (bestY) {
    const snapped = { ...moving, y: moving.y + dy };
    lines.push({
      axis: "y",
      pos: bestY.pos,
      from: Math.min(snapped.x, bestY.other.x),
      to: Math.max(snapped.x + snapped.w, bestY.other.x + bestY.other.w),
    });
  }

  return { dx, dy, lines };
}

/** Scales an element's geometry in place (used to bake a transform's scale). */
export function scaleElement(
  el: BoardElement,
  scaleX: number,
  scaleY: number
): BoardElement {
  if (el.type === "connector") return el; // geometry is endpoint-derived; nothing to scale
  if (el.type === "path" || el.type === "arrow") {
    const points = el.points.map((p, i) => (i % 2 === 0 ? p * scaleX : p * scaleY));
    return { ...el, points };
  }
  if (el.type === "text") {
    return { ...el, w: Math.max(20, el.w * scaleX), fontSize: Math.max(6, el.fontSize * scaleY) };
  }
  return { ...el, w: Math.max(4, el.w * scaleX), h: Math.max(4, el.h * scaleY) };
}

/** Where a ray from a box's center toward `toward` exits the box border. */
function rectBorderPoint(box: Box, toward: { x: number; y: number }): { x: number; y: number } {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const scaleX = dx !== 0 ? box.w / 2 / Math.abs(dx) : Infinity;
  const scaleY = dy !== 0 ? box.h / 2 / Math.abs(dy) : Infinity;
  const scale = Math.min(scaleX, scaleY);
  return { x: cx + dx * scale, y: cy + dy * scale };
}

function endpointCenter(
  ep: ConnectorElement["start"],
  elements: Record<string, BoardElement>
): { x: number; y: number } | null {
  if (ep.kind === "point") return { x: ep.x, y: ep.y };
  const el = elements[ep.elementId];
  if (!el) return null;
  const b = absBounds(el);
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

/**
 * Resolve a connector to absolute `[x1,y1,x2,y2]`. Element-bound ends are
 * trimmed to the element's border (pointing at the opposite end). Returns null
 * when an endpoint references a deleted element (dangling connector).
 */
export function resolveConnector(
  c: ConnectorElement,
  elements: Record<string, BoardElement>
): [number, number, number, number] | null {
  const startC = endpointCenter(c.start, elements);
  const endC = endpointCenter(c.end, elements);
  if (!startC || !endC) return null;

  let p1 = startC;
  let p2 = endC;
  if (c.start.kind === "element") {
    p1 = rectBorderPoint(absBounds(elements[c.start.elementId]!), endC);
  }
  if (c.end.kind === "element") {
    p2 = rectBorderPoint(absBounds(elements[c.end.elementId]!), startC);
  }
  return [p1.x, p1.y, p2.x, p2.y];
}
