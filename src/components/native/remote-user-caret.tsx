"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/core/utils";

type Props = {
  name: string;
  color: string;
  className?: string;
  style?: CSSProperties;
};

/** Live collaborator pointer shown on canvas-native surfaces (boards, slides, etc.). */
export function RemoteUserCaret({ name, color, className, style }: Props) {
  return (
    <div
      className={cn("pointer-events-none absolute z-20 will-change-transform", className)}
      style={style}
    >
      <svg
        width={18}
        height={18}
        viewBox="0 0 24 24"
        fill={color}
        stroke="#fff"
        strokeWidth={1.5}
        className="drop-shadow-sm"
        aria-hidden
      >
        <path d="M5 3l14 7-6 1.5L9 18 5 3z" />
      </svg>
      <span
        className="absolute left-3.5 top-3.5 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium text-white shadow-sm"
        style={{ backgroundColor: color }}
      >
        {name}
      </span>
    </div>
  );
}

export type RemoteUserCaretPosition = { userId: string; name: string; color: string; x: number; y: number };

type LayerProps = {
  cursors: RemoteUserCaretPosition[];
  /** Map scene coordinates to pixel offsets within the overlay container. */
  toPixels: (cursor: RemoteUserCaretPosition) => { left: number; top: number };
};

export function RemoteUserCaretLayer({ cursors, toPixels }: LayerProps) {
  return (
    <>
      {cursors.map((cursor) => {
        const { left, top } = toPixels(cursor);
        return (
          <RemoteUserCaret
            key={cursor.userId}
            name={cursor.name}
            color={cursor.color}
            style={{ left, top }}
          />
        );
      })}
    </>
  );
}
