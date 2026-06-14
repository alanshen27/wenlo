"use client";

import { useEffect, useState } from "react";
import { Image as KonvaImage } from "react-konva";

/**
 * Loads an <img> and renders it as a Konva Image at local (0,0). Positioning,
 * dragging and selection are handled by the enclosing Group. Shared by the
 * whiteboard and slideshow canvases.
 */
export function CanvasImageNode({
  src,
  width,
  height,
}: {
  src: string;
  width: number;
  height: number;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.src = src;
    const onLoad = () => setImg(image);
    image.addEventListener("load", onLoad);
    return () => image.removeEventListener("load", onLoad);
  }, [src]);

  return <KonvaImage image={img ?? undefined} width={width} height={height} />;
}
