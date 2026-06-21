"use client";

import { Circle, Group } from "react-konva";
import type Konva from "konva";
import type { ConnectorElement, SceneElement } from "@/lib/scene/elements";
import {
  computePointSnap,
  endpointAbsPositions,
  moveArrowEndpoint,
  moveConnectorEndpoint,
  moveLineShapeEndpoint,
  type Box,
  type SnapLine,
} from "@/lib/scene/scene-geometry";

const HANDLE_RADIUS = 6;

type Props = {
  element: SceneElement;
  elements: Record<string, SceneElement>;
  snapOthers: Box[];
  snapThreshold: number;
  scale: number;
  onGuides: (lines: SnapLine[]) => void;
  onUpdate: (el: SceneElement) => void;
  hitTest: (pos: { x: number; y: number }) => string | null;
};

export function SceneEndpointHandles({
  element,
  elements,
  snapOthers,
  snapThreshold,
  scale,
  onGuides,
  onUpdate,
  hitTest,
}: Props) {
  const endpoints = endpointAbsPositions(element, elements);
  if (!endpoints) return null;

  const r = HANDLE_RADIUS / scale;

  const handleDrag =
    (index: 0 | 1) => (e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      let x = node.x();
      let y = node.y();
      const snapped = computePointSnap({ x, y }, snapOthers, snapThreshold);
      x = snapped.x;
      y = snapped.y;
      node.x(x);
      node.y(y);
      onGuides(snapped.lines);

      if (element.type === "arrow") {
        onUpdate(moveArrowEndpoint(element, index, x, y));
      } else if (element.type === "shape" && element.shape === "line") {
        onUpdate(moveLineShapeEndpoint(element, index, x, y));
      } else if (element.type === "connector") {
        const which = index === 0 ? "start" : "end";
        const hit = hitTest({ x, y });
        const skip =
          hit &&
          ((which === "start" && element.end.kind === "element" && element.end.elementId === hit) ||
            (which === "end" && element.start.kind === "element" && element.start.elementId === hit));
        onUpdate(
          moveConnectorEndpoint(element, which, x, y, skip ? null : hit) as ConnectorElement
        );
      }
    };

  const handleDragEnd = () => onGuides([]);

  return (
    <Group listening>
      {endpoints.map((pt, i) => (
        <Circle
          key={i}
          x={pt.x}
          y={pt.y}
          radius={r}
          fill="#ffffff"
          stroke="#3b82f6"
          strokeWidth={2 / scale}
          draggable
          onDragMove={handleDrag(i as 0 | 1)}
          onDragEnd={handleDragEnd}
          hitStrokeWidth={12 / scale}
        />
      ))}
    </Group>
  );
}
