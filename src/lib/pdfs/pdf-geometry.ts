/** Squared distance between two normalized points. */
function distSq(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/** Squared distance from point (px,py) to segment (x1,y1)-(x2,y2). */
function distSqPointSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return distSq(px, py, x1, y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return distSq(px, py, cx, cy);
}

/** True when (nx,ny) is within `threshold` of any vertex or edge of a polyline. */
export function hitTestPolyline(
  points: number[],
  nx: number,
  ny: number,
  threshold: number
): boolean {
  if (points.length < 2) return false;
  const t2 = threshold * threshold;
  for (let i = 0; i < points.length; i += 2) {
    if (distSq(points[i]!, points[i + 1]!, nx, ny) <= t2) return true;
  }
  for (let i = 0; i < points.length - 2; i += 2) {
    if (
      distSqPointSegment(
        nx,
        ny,
        points[i]!,
        points[i + 1]!,
        points[i + 2]!,
        points[i + 3]!
      ) <= t2
    ) {
      return true;
    }
  }
  return false;
}

/** Hit-test a normalized box. */
export function hitTestBox(
  x: number,
  y: number,
  w: number,
  h: number,
  nx: number,
  ny: number
): boolean {
  return nx >= x && nx <= x + w && ny >= y && ny <= y + h;
}
