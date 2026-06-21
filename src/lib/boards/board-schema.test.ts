import { describe, expect, it } from "vitest";
import {
  applyBoardPatch,
  BOARD_VERSION,
  createEmptyBoard,
  deriveBoardText,
  normalizeBoard,
  type BoardDoc,
  type BoardElement,
} from "./board-schema";

function shape(id: string): BoardElement {
  return { id, type: "shape", shape: "rect", x: 0, y: 0, w: 10, h: 10 };
}

function sceneOf(elements: BoardElement[]): BoardDoc {
  return {
    version: BOARD_VERSION,
    elementOrder: elements.map((e) => e.id),
    elements: Object.fromEntries(elements.map((e) => [e.id, e])),
  };
}

describe("normalizeBoard", () => {
  it("returns an empty board for non-object input", () => {
    expect(normalizeBoard(undefined)).toEqual(createEmptyBoard());
    expect(normalizeBoard("nope")).toEqual(createEmptyBoard());
  });

  it("appends elements missing from elementOrder", () => {
    const board = normalizeBoard({
      version: BOARD_VERSION,
      elements: { a: shape("a"), b: shape("b") },
      elementOrder: ["a"],
    });
    expect(board.elementOrder).toEqual(["a", "b"]);
  });

  it("drops order ids without a backing element", () => {
    const board = normalizeBoard({
      version: BOARD_VERSION,
      elements: { a: shape("a") },
      elementOrder: ["a", "ghost"],
    });
    expect(board.elementOrder).toEqual(["a"]);
  });
});

describe("applyBoardPatch", () => {
  it("appends upserted elements to the existing order", () => {
    const next = applyBoardPatch(sceneOf([shape("a")]), { upserts: { b: shape("b") } });
    expect(next.elementOrder).toEqual(["a", "b"]);
  });

  it("removes deleted elements and prunes them from order", () => {
    const next = applyBoardPatch(sceneOf([shape("a"), shape("b")]), { deletes: ["a"] });
    expect(next.elements.a).toBeUndefined();
    expect(next.elementOrder).toEqual(["b"]);
  });

  it("honors an explicit elementOrder, appending any stragglers", () => {
    const next = applyBoardPatch(sceneOf([shape("a"), shape("b")]), {
      upserts: { c: shape("c") },
      elementOrder: ["c", "b", "a"],
    });
    expect(next.elementOrder).toEqual(["c", "b", "a"]);
  });

  it("forces the upsert key as the element id", () => {
    const next = applyBoardPatch(createEmptyBoard(), {
      upserts: { a: { ...shape("mismatch") } },
    });
    expect(next.elements.a.id).toBe("a");
  });

  it("does not mutate the input scene", () => {
    const scene = sceneOf([shape("a")]);
    const snapshot = JSON.parse(JSON.stringify(scene));
    applyBoardPatch(scene, { deletes: ["a"] });
    expect(scene).toEqual(snapshot);
  });
});

describe("deriveBoardText", () => {
  it("collects text and sticky content in z-order", () => {
    const scene: BoardDoc = sceneOf([
      { id: "t", type: "text", x: 0, y: 0, text: "Hello", w: 100, h: 24, fontSize: 16, color: "#000" },
      shape("s"),
      { id: "n", type: "sticky", x: 0, y: 0, text: "Note", w: 50, h: 50, fill: "#ff0", color: "#000" },
    ]);
    expect(deriveBoardText(scene)).toBe("Hello\nNote");
  });
});
