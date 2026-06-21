// Whiteboard scene — re-exports the shared scene model.

export {
  type ArrowElement,
  type ConnectorElement,
  type ConnectorEndpoint,
  type ImageElement,
  type PathElement,
  type SceneElement as BoardElement,
  type SceneElementType as BoardElementType,
  type ShapeElement,
  type StickyElement,
  type TextElement,
} from "@/lib/scene/elements";

export {
  SCENE_VERSION as BOARD_VERSION,
  type SceneDoc as BoardDoc,
  type ScenePatch as BoardPatch,
  applyScenePatch as applyBoardPatch,
  createEmptyScene as createEmptyBoard,
  deriveSceneText as deriveBoardText,
  normalizeScene as normalizeBoard,
} from "@/lib/scene/scene-schema";

export type Viewport = { x: number; y: number; zoom: number };
