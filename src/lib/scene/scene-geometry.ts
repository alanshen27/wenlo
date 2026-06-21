import type { ArrowElement, ConnectorElement, ConnectorEndpoint, SceneElement, ShapeElement } from "@/lib/scene/elements";

export type Box = { x: number; y: number; w: number; h: number };

/** Local bounding box of an element, ignoring rotation. */
export function localBounds(el: SceneElement): Box {
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
    return { x: 0, y: 0, w: el.w, h: el.h || el.fontSize * 1.4 };
  }
  return { x: 0, y: 0, w: el.w, h: el.h };
}

export function absBounds(el: SceneElement): Box {
  const lb = localBounds(el);
  return { x: el.x + lb.x, y: el.y + lb.y, w: lb.w, h: lb.h };
}

export type SnapLine = { axis: "x" | "y"; pos: number; from: number; to: number };
export type SnapResult = { dx: number; dy: number; lines: SnapLine[] };

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

/** Snap a single point to nearby box edges/centers (for line endpoint editing). */
export function computePointSnap(
  point: { x: number; y: number },
  others: Box[],
  threshold: number
): { x: number; y: number; lines: SnapLine[] } {
  const moving: Box = { x: point.x, y: point.y, w: 0, h: 0 };
  const { dx, dy, lines } = computeSnap(moving, others, threshold);
  return { x: point.x + dx, y: point.y + dy, lines };
}

/** Like computeSnap but also snaps to fixed-canvas edges and center lines. */
export function computeSnapWithCanvas(
  moving: Box,
  others: Box[],
  canvas: { w: number; h: number } | null,
  threshold: number
): SnapResult {
  const extra: Box[] = [...others];
  if (canvas) {
    extra.push({ x: 0, y: 0, w: canvas.w, h: canvas.h });
  }
  return computeSnap(moving, extra, threshold);
}

/** Absolute scene coordinates for editable endpoints. */
export function endpointAbsPositions(
  el: SceneElement,
  elements: Record<string, SceneElement>
): [{ x: number; y: number }, { x: number; y: number }] | null {
  if (el.type === "arrow") {
    return [
      { x: el.x + el.points[0], y: el.y + el.points[1] },
      { x: el.x + el.points[2], y: el.y + el.points[3] },
    ];
  }
  if (el.type === "shape" && el.shape === "line") {
    return [
      { x: el.x, y: el.y },
      { x: el.x + el.w, y: el.y + el.h },
    ];
  }
  if (el.type === "connector") {
    const resolved = resolveConnector(el, elements);
    if (!resolved) return null;
    return [
      { x: resolved[0], y: resolved[1] },
      { x: resolved[2], y: resolved[3] },
    ];
  }
  return null;
}

/** Normalize arrow points so (x,y) is the top-left of the bounding box. */
export function moveArrowEndpoint(
  el: ArrowElement,
  index: 0 | 1,
  absX: number,
  absY: number
): ArrowElement {
  const pts = endpointAbsPositions(el, {})!;
  const next: [{ x: number; y: number }, { x: number; y: number }] =
    index === 0 ? [{ x: absX, y: absY }, pts[1]] : [pts[0], { x: absX, y: absY }];
  const minX = Math.min(next[0].x, next[1].x);
  const minY = Math.min(next[0].y, next[1].y);
  return {
    ...el,
    x: minX,
    y: minY,
    points: [
      next[0].x - minX,
      next[0].y - minY,
      next[1].x - minX,
      next[1].y - minY,
    ],
  };
}

export function moveLineShapeEndpoint(
  el: ShapeElement,
  index: 0 | 1,
  absX: number,
  absY: number
): ShapeElement {
  if (el.shape !== "line") return el;
  const pts = endpointAbsPositions(el, {})!;
  const next: [{ x: number; y: number }, { x: number; y: number }] =
    index === 0 ? [{ x: absX, y: absY }, pts[1]] : [pts[0], { x: absX, y: absY }];
  return { ...el, x: next[0].x, y: next[0].y, w: next[1].x - next[0].x, h: next[1].y - next[0].y };
}

export function moveConnectorEndpoint(
  el: ConnectorElement,
  which: "start" | "end",
  absX: number,
  absY: number,
  hitElementId: string | null
): ConnectorElement {
  const ep: ConnectorEndpoint = hitElementId
    ? { kind: "element", elementId: hitElementId }
    : { kind: "point", x: absX, y: absY };
  return which === "start" ? { ...el, start: ep } : { ...el, end: ep };
}

/** Bakes a Konva transform scale into element geometry. */
export function scaleElement(el: SceneElement, scaleX: number, scaleY: number): SceneElement {
  if (el.type === "connector") return el;
  if (el.type === "path" || el.type === "arrow") {
    const points = el.points.map((p, i) => (i % 2 === 0 ? p * scaleX : p * scaleY));
    return { ...el, points };
  }
  if (el.type === "text") {
    const fontSize = Math.max(4, Math.round(el.fontSize * scaleY));
    return {
      ...el,
      w: Math.max(20, el.w * scaleX),
      h: Math.max(fontSize, (el.h || fontSize * 1.2) * scaleY),
      fontSize,
    };
  }
  if (el.type === "shape" && el.shape === "line") {
    return { ...el, w: el.w * scaleX, h: el.h * scaleY };
  }
  return { ...el, w: Math.max(4, el.w * scaleX), h: Math.max(4, el.h * scaleY) };
}

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
  elements: Record<string, SceneElement>
): { x: number; y: number } | null {
  if (ep.kind === "point") return { x: ep.x, y: ep.y };
  const el = elements[ep.elementId];
  if (!el) return null;
  const b = absBounds(el);
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

export function resolveConnector(
  c: ConnectorElement,
  elements: Record<string, SceneElement>
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
