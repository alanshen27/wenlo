// Canonical shape vocabulary shared by the slideshow (deck) and whiteboard
// (board) canvases. Both store shapes as a `{ shape, w, h }` box, so a shape is
// fully described by how to draw it inside that box. "rect"/"ellipse" are drawn
// with native Konva nodes; "line" is an open stroke; everything else is a
// closed polygon whose vertices are derived from the box here.

export type ShapeKind =
  | "rect"
  | "ellipse"
  | "line"
  | "triangle"
  | "diamond"
  | "pentagon"
  | "hexagon"
  | "octagon"
  | "star"
  | "rightArrow";

/** Shapes that aren't bounded-box polygons (handled by dedicated Konva nodes). */
export const NON_POLYGON_SHAPES: ReadonlySet<ShapeKind> = new Set([
  "rect",
  "ellipse",
  "line",
]);

/** Regular n-gon inscribed in the box's ellipse, first vertex at top-center. */
function regularPolygon(sides: number, w: number, h: number): number[] {
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2;
  const ry = h / 2;
  const pts: number[] = [];
  for (let i = 0; i < sides; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / sides;
    pts.push(cx + rx * Math.cos(a), cy + ry * Math.sin(a));
  }
  return pts;
}

/** n-pointed star inscribed in the box, alternating outer/inner radii. */
function starPolygon(points: number, w: number, h: number, innerRatio = 0.45): number[] {
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2;
  const ry = h / 2;
  const pts: number[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? 1 : innerRatio;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    pts.push(cx + rx * r * Math.cos(a), cy + ry * r * Math.sin(a));
  }
  return pts;
}

/**
 * Flat point list `[x0,y0,x1,y1,...]` for a closed polygon shape, sized to the
 * given box. Returns `null` for shapes that are not closed polygons
 * (rect/ellipse/line), which callers render with their own Konva nodes.
 */
export function shapePolygonPoints(shape: ShapeKind, w: number, h: number): number[] | null {
  switch (shape) {
    case "triangle":
      return [w / 2, 0, w, h, 0, h];
    case "diamond":
      return [w / 2, 0, w, h / 2, w / 2, h, 0, h / 2];
    case "pentagon":
      return regularPolygon(5, w, h);
    case "hexagon":
      return regularPolygon(6, w, h);
    case "octagon":
      return regularPolygon(8, w, h);
    case "star":
      return starPolygon(5, w, h);
    case "rightArrow": {
      const top = h * 0.28;
      const bot = h * 0.72;
      const neck = w * 0.6;
      return [0, top, neck, top, neck, 0, w, h / 2, neck, h, neck, bot, 0, bot];
    }
    default:
      return null;
  }
}

/** Same polygon, formatted as an SVG `points` string (`"x,y x,y …"`), or null
 *  for non-polygon shapes. Used by the dependency-free SVG previews. */
export function shapePolygonSvgPoints(shape: ShapeKind, w: number, h: number): string | null {
  const pts = shapePolygonPoints(shape, w, h);
  if (!pts) return null;
  const out: string[] = [];
  for (let i = 0; i < pts.length; i += 2) out.push(`${pts[i]},${pts[i + 1]}`);
  return out.join(" ");
}
