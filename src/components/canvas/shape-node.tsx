"use client";

import { Rect, Ellipse, Line } from "react-konva";
import { shapePolygonPoints, type ShapeKind } from "@/lib/canvas/shapes";

/**
 * Renders a shape's geometry at local (0,0) inside a `w`×`h` box. Shared by the
 * deck and board canvases (and their preview/present modes) so a shape looks the
 * same everywhere and new shapes only need a single entry in `shapePolygonPoints`.
 */
export function ShapeNode({
  shape,
  w,
  h,
  fill,
  stroke,
  strokeWidth,
  cornerRadius,
}: {
  shape: ShapeKind;
  w: number;
  h: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
}) {
  const solidFill = fill && fill !== "transparent" ? fill : undefined;
  const solidStroke = stroke && stroke !== "transparent" ? stroke : undefined;

  if (shape === "rect") {
    return (
      <Rect
        width={w}
        height={h}
        fill={solidFill}
        stroke={solidStroke}
        strokeWidth={strokeWidth}
        cornerRadius={cornerRadius ?? 0}
      />
    );
  }

  if (shape === "ellipse") {
    return (
      <Ellipse
        x={w / 2}
        y={h / 2}
        radiusX={Math.abs(w / 2)}
        radiusY={Math.abs(h / 2)}
        fill={solidFill}
        stroke={solidStroke}
        strokeWidth={strokeWidth}
      />
    );
  }

  if (shape === "line") {
    return (
      <Line
        points={[0, 0, w, h]}
        stroke={solidStroke ?? "#000"}
        strokeWidth={strokeWidth ?? 2}
        lineCap="round"
      />
    );
  }

  const points = shapePolygonPoints(shape, w, h);
  if (!points) return null;
  return (
    <Line
      points={points}
      closed
      fill={solidFill}
      stroke={solidStroke}
      strokeWidth={strokeWidth}
      lineJoin="round"
    />
  );
}
