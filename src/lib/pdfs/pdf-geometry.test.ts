import { describe, expect, it } from "vitest";
import { hitTestBox, hitTestPolyline } from "./pdf-geometry";

describe("hitTestPolyline", () => {
  it("hits near a vertex", () => {
    expect(hitTestPolyline([0.1, 0.1, 0.5, 0.5], 0.1, 0.11, 0.02)).toBe(true);
  });

  it("hits near a segment", () => {
    expect(hitTestPolyline([0, 0.5, 1, 0.5], 0.5, 0.52, 0.03)).toBe(true);
  });

  it("misses far away", () => {
    expect(hitTestPolyline([0, 0, 0.1, 0.1], 0.9, 0.9, 0.01)).toBe(false);
  });
});

describe("hitTestBox", () => {
  it("detects inside the box", () => {
    expect(hitTestBox(0.1, 0.1, 0.2, 0.1, 0.15, 0.12)).toBe(true);
  });
});
