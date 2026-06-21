"use client";

import { Arrow, Group, Label, Line, Rect, Tag, Text as KonvaText } from "react-konva";
import type Konva from "konva";
import type { ConnectorElement, SceneElement } from "@/lib/scene/elements";
import { CanvasImageNode } from "@/components/canvas/canvas-image";
import { SceneTextNode } from "@/components/canvas/scene-text-node";
import { ShapeNode } from "@/components/canvas/shape-node";
import { BoardImageNode } from "@/components/whiteboard/board-image";
import { localBounds } from "@/lib/scene/scene-geometry";
import type { LockHolder } from "@/components/whiteboard/use-board-collab";

/**
 * Renders a scene element's visual content at local (0,0). Used by the unified
 * scene canvas, present mode, and previews.
 */
export function SceneElementContent({ el, hideText }: { el: SceneElement; hideText?: boolean }) {
  if (el.type === "path") {
    return (
      <Line
        points={el.points}
        stroke={el.stroke}
        strokeWidth={el.strokeWidth}
        lineCap="round"
        lineJoin="round"
        tension={0.4}
        hitStrokeWidth={Math.max(12, el.strokeWidth + 8)}
      />
    );
  }

  if (el.type === "arrow") {
    return (
      <Arrow
        points={el.points}
        stroke={el.stroke}
        fill={el.stroke}
        strokeWidth={el.strokeWidth}
        pointerLength={10}
        pointerWidth={10}
        hitStrokeWidth={Math.max(12, el.strokeWidth + 8)}
      />
    );
  }

  if (el.type === "shape") {
    return (
      <ShapeNode
        shape={el.shape}
        w={el.w}
        h={el.h}
        fill={el.fill}
        stroke={el.stroke}
        strokeWidth={el.strokeWidth}
        cornerRadius={el.shape === "rect" ? el.radius ?? 6 : undefined}
      />
    );
  }

  if (el.type === "sticky") {
    return (
      <>
        <Rect
          width={el.w}
          height={el.h}
          fill={el.fill}
          cornerRadius={4}
          shadowColor="#000"
          shadowBlur={6}
          shadowOpacity={0.12}
          shadowOffsetY={2}
        />
        {!hideText && (
          <KonvaText
            text={el.text}
            x={12}
            y={12}
            width={el.w - 24}
            fontSize={16}
            fill={el.color}
            wrap="word"
          />
        )}
      </>
    );
  }

  if (el.type === "text") {
    if (hideText) return null;
    return <SceneTextNode el={el} />;
  }

  if (el.type === "image") {
    const caption = el.caption?.trim();
    return (
      <>
        {el.documentId ? (
          <BoardImageNode element={el} />
        ) : (
          <CanvasImageNode src={el.src} width={el.w} height={el.h} />
        )}
        {caption && !hideText && (
          <KonvaText
            text={caption}
            y={el.h + 6}
            width={el.w}
            fontSize={14}
            fontFamily="Arial"
            fill="#64748b"
            align="center"
            wrap="word"
          />
        )}
      </>
    );
  }

  return null;
}

export function SceneConnectorNode({
  connector,
  points,
  lockedBy,
  listening,
  onSelect,
  preview,
}: {
  connector: ConnectorElement;
  points: [number, number, number, number] | null;
  lockedBy: LockHolder | null;
  listening?: boolean;
  onSelect?: () => void;
  preview?: boolean;
}) {
  if (!points) return null;
  return (
    <>
      {lockedBy && (
        <Line
          points={points}
          stroke={lockedBy.color}
          strokeWidth={connector.strokeWidth + 6}
          opacity={0.35}
          lineCap="round"
          listening={false}
          strokeScaleEnabled={false}
        />
      )}
      <Arrow
        points={points}
        stroke={connector.stroke}
        fill={connector.stroke}
        strokeWidth={connector.strokeWidth}
        pointerLength={10}
        pointerWidth={10}
        hitStrokeWidth={16}
        listening={!preview && !lockedBy && Boolean(listening)}
        onMouseDown={onSelect}
        onTap={onSelect}
      />
      {lockedBy && (
        <Label x={points[0]} y={points[1] - 22}>
          <Tag fill={lockedBy.color} cornerRadius={3} />
          <KonvaText text={lockedBy.name} fontSize={11} fill="#fff" padding={4} />
        </Label>
      )}
    </>
  );
}

export function SceneElementNode({
  element,
  lockedBy,
  draggable,
  onRef,
  onSelect,
  onDblClick,
  onDragMove,
  onDragEnd,
  onTransformEnd,
  hideText,
  preview,
}: {
  element: SceneElement;
  lockedBy: LockHolder | null;
  draggable: boolean;
  onRef?: (node: Konva.Group | null) => void;
  onSelect?: () => void;
  onDblClick?: () => void;
  onDragMove?: (node: Konva.Group) => void;
  onDragEnd?: (node: Konva.Group) => void;
  onTransformEnd?: (node: Konva.Group) => void;
  hideText?: boolean;
  preview?: boolean;
}) {
  const el = element;
  const bounds = localBounds(el);

  return (
    <Group
      ref={onRef}
      x={el.x}
      y={el.y}
      rotation={el.rotation ?? 0}
      opacity={el.opacity ?? 1}
      draggable={draggable}
      listening={!preview && !lockedBy}
      onMouseDown={onSelect}
      onTap={onSelect}
      onDblClick={onDblClick}
      onDblTap={onDblClick}
      onDragMove={(e) => onDragMove?.(e.target as Konva.Group)}
      onDragEnd={(e) => onDragEnd?.(e.target as Konva.Group)}
      onTransformEnd={(e) => onTransformEnd?.(e.target as Konva.Group)}
    >
      <SceneElementContent el={el} hideText={hideText} />

      {lockedBy && (
        <>
          <Rect
            x={bounds.x - 4}
            y={bounds.y - 4}
            width={bounds.w + 8}
            height={bounds.h + 8}
            stroke={lockedBy.color}
            strokeWidth={1.5}
            dash={[6, 4]}
            cornerRadius={4}
            listening={false}
            strokeScaleEnabled={false}
          />
          <Label x={bounds.x} y={bounds.y - 22}>
            <Tag fill={lockedBy.color} cornerRadius={3} />
            <KonvaText text={lockedBy.name} fontSize={11} fill="#fff" padding={4} />
          </Label>
        </>
      )}
    </Group>
  );
}
