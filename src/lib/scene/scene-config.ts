import type { ShapeKind } from "@/lib/canvas/shapes";

/** All tools the unified scene canvas understands. */
export type SceneTool =
  | "select"
  | "pan"
  | "pen"
  | "arrow"
  | "connector"
  | "text"
  | "sticky"
  | "image"
  | ShapeKind;

export type FixedViewport = {
  kind: "fixed";
  width: number;
  height: number;
  margin?: number;
};

export type InfiniteViewport = {
  kind: "infinite";
};

export type SceneViewport = FixedViewport | InfiniteViewport;

export type SceneProfile = "deck" | "board";

export type SceneCanvasConfig = {
  profile: SceneProfile;
  viewport: SceneViewport;
  /** Tools shown in the toolbar for this profile. */
  tools: SceneTool[];
};

export const DECK_WIDTH = 1280;
export const DECK_HEIGHT = 720;
export const DEFAULT_SLIDE_BG = "#ffffff";

export const DECK_SCENE_CONFIG: SceneCanvasConfig = {
  profile: "deck",
  viewport: { kind: "fixed", width: DECK_WIDTH, height: DECK_HEIGHT, margin: 28 },
  tools: ["select", "text", "rect", "ellipse", "line", "triangle", "diamond", "pentagon", "hexagon", "octagon", "star", "rightArrow", "arrow", "connector"],
};

export const BOARD_SCENE_CONFIG: SceneCanvasConfig = {
  profile: "board",
  viewport: { kind: "infinite" },
  tools: [
    "select",
    "pan",
    "pen",
    "rect",
    "ellipse",
    "line",
    "triangle",
    "diamond",
    "pentagon",
    "hexagon",
    "octagon",
    "star",
    "rightArrow",
    "arrow",
    "connector",
    "text",
    "sticky",
    "image",
  ],
};
