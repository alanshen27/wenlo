"use client";

import { useCallback, useEffect, useState } from "react";
import { Stage, Layer, Group, Rect } from "react-konva";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  DECK_HEIGHT,
  DECK_WIDTH,
  DEFAULT_SLIDE_BG,
  type DeckDoc,
  type DeckElement,
} from "@/lib/decks/deck-schema";
import { ElementContent } from "@/components/slideshow/slide-konva";

/** Fullscreen, keyboard-navigable presentation of the deck. */
export function PresentOverlay({
  deck,
  startIndex,
  onExit,
}: {
  deck: DeckDoc;
  startIndex: number;
  onExit: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const count = deck.slideOrder.length;
  const slideId = deck.slideOrder[Math.min(index, count - 1)];
  const slide = deck.slides[slideId];

  const next = useCallback(() => setIndex((i) => Math.min(count - 1, i + 1)), [count]);
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    const update = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        prev();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onExit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onExit]);

  const scale = size.width
    ? Math.min(size.width / DECK_WIDTH, size.height / DECK_HEIGHT)
    : 0;
  const stageW = DECK_WIDTH * scale;
  const stageH = DECK_HEIGHT * scale;

  const elements = slide
    ? slide.elementOrder
        .map((id) => slide.elements[id])
        .filter((el): el is DeckElement => Boolean(el))
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      {scale > 0 && (
        <Stage width={stageW} height={stageH} scaleX={scale} scaleY={scale}>
          <Layer>
            <Rect
              x={0}
              y={0}
              width={DECK_WIDTH}
              height={DECK_HEIGHT}
              fill={slide?.background ?? deck.theme?.background ?? DEFAULT_SLIDE_BG}
            />
            {elements.map((el) => (
              <Group
                key={el.id}
                x={el.x}
                y={el.y}
                rotation={el.rotation ?? 0}
                opacity={el.opacity ?? 1}
                listening={false}
              >
                <ElementContent el={el} />
              </Group>
            ))}
          </Layer>
        </Stage>
      )}

      <button
        type="button"
        onClick={onExit}
        aria-label="Exit presentation (Esc)"
        className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
      >
        <X className="size-5" />
      </button>

      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-white/10 px-3 py-1.5 text-white/80 backdrop-blur">
        <button
          type="button"
          onClick={prev}
          disabled={index === 0}
          aria-label="Previous slide"
          className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-white/20 hover:text-white disabled:opacity-30"
        >
          <ChevronLeft className="size-5" />
        </button>
        <span className="min-w-12 text-center text-sm tabular-nums">
          {index + 1} / {count}
        </span>
        <button
          type="button"
          onClick={next}
          disabled={index === count - 1}
          aria-label="Next slide"
          className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-white/20 hover:text-white disabled:opacity-30"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
    </div>
  );
}
