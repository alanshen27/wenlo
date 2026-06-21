"use client";

import { Text as KonvaText } from "react-konva";
import type { TextElement } from "@/lib/scene/elements";
import { BULLET_CHAR, splitTextLines } from "@/lib/scene/text-list";

const LINE_HEIGHT = 1.2;

function displayText(el: TextElement): string {
  if (el.listStyle !== "bullet") return el.text || " ";
  const lines = splitTextLines(el.text);
  return lines.map((line) => `${BULLET_CHAR} ${line}`).join("\n");
}

export function SceneTextNode({ el }: { el: TextElement }) {
  const hasLink = Boolean(el.link?.trim());

  return (
    <KonvaText
      text={displayText(el)}
      width={el.w}
      fontSize={el.fontSize}
      fontFamily={el.fontFamily || "Arial"}
      fontStyle={`${el.italic ? "italic " : ""}${(el.fontWeight ?? 400) >= 600 ? "bold" : "normal"}`.trim()}
      fill={hasLink ? "#2563eb" : el.color}
      align={el.align ?? "left"}
      wrap="word"
      lineHeight={LINE_HEIGHT}
      textDecoration={el.underline || hasLink ? "underline" : ""}
    />
  );
}
