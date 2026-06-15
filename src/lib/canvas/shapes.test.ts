import { describe, expect, it } from "vitest";
import {
  NON_POLYGON_SHAPES,
  shapePolygonPoints,
  shapePolygonSvgPoints,
  type ShapeKind,
} from "./shapes";

describe("shapePolygonPoints", () => {
  it("returns null for non-polygon shapes", () => {
    for (const shape of NON_POLYGON_SHAPES) {
      expect(shapePolygonPoints(shape, 100, 50)).toBeNull();
    }
  });

  it("draws a diamond as the box's four edge midpoints", () => {
    expect(shapePolygonPoints("diamond", 100, 50)).toEqual([50, 0, 100, 25, 50, 50, 0, 25]);
  });

  it("draws a triangle with its apex at top-center", () => {
    expect(shapePolygonPoints("triangle", 100, 50)).toEqual([50, 0, 100, 50, 0, 50]);
  });

  it("returns 2 coordinates per vertex for regular polygons", () => {
    expect(shapePolygonPoints("pentagon", 80, 80)).toHaveLength(10);
    expect(shapePolygonPoints("hexagon", 80, 80)).toHaveLength(12);
    expect(shapePolygonPoints("octagon", 80, 80)).toHaveLength(16);
  });

  it("places the first regular-polygon vertex at top-center", () => {
    const pts = shapePolygonPoints("pentagon", 80, 80)!;
    expect(pts[0]).toBeCloseTo(40);
    expect(pts[1]).toBeCloseTo(0);
  });

  it("alternates outer/inner radii for a 5-point star (20 coords)", () => {
    expect(shapePolygonPoints("star", 100, 100)).toHaveLength(20);
  });
});

describe("shapePolygonSvgPoints", () => {
  it("formats the polygon as an SVG points string", () => {
    expect(shapePolygonSvgPoints("diamond", 100, 50)).toBe("50,0 100,25 50,50 0,25");
  });

  it("returns null for non-polygon shapes", () => {
    const shape: ShapeKind = "ellipse";
    expect(shapePolygonSvgPoints(shape, 10, 10)).toBeNull();
  });
});
