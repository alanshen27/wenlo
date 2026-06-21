import { describe, expect, it } from "vitest";
import { extractGrepPatterns, findLineMatches } from "@/lib/search/grep-utils";

describe("grep", () => {
  it("extracts quoted phrases and salient tokens", () => {
    const patterns = extractGrepPatterns('How does "backpropagation" work in my notes?');
    expect(patterns).toContain("backpropagation");
    expect(patterns[0]).toBe("backpropagation");
  });

  it("finds line matches with context", () => {
    const text = "alpha\nbeta TARGET gamma\ndelta";
    const hits = findLineMatches(text, "TARGET", { contextLines: 1 });
    expect(hits).toHaveLength(1);
    expect(hits[0].lineNumber).toBe(2);
    expect(hits[0].before).toEqual(["alpha"]);
    expect(hits[0].after).toEqual(["delta"]);
  });
});
