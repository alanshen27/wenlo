import { describe, expect, it } from "vitest";
import {
  formatToolCallBlock,
  formatToolResultBlock,
  hasOpenToolFence,
  parseAnswerSegments,
  parseToolCallBlock,
  parseToolResultBlock,
} from "./recall-tool-blocks";

describe("recall-tool-blocks", () => {
  it("formats and parses tool_call blocks", () => {
    const call = { id: "call_1", name: "search_library", arguments: { libraryId: "lib", query: "test" } };
    const block = formatToolCallBlock(call);
    expect(block).toContain("```tool_call");
    expect(parseToolCallBlock(block)).toEqual(call);
  });

  it("formats and parses tool_result blocks", () => {
    const result = { id: "call_1", result: { count: 2 }, isError: false };
    const block = formatToolResultBlock(result);
    expect(block).toContain("```tool_result");
    expect(parseToolResultBlock(block)).toEqual(result);
  });

  it("detects open tool fences while streaming", () => {
    expect(hasOpenToolFence("Hello\n\n```tool_call\n{\"id\":")).toBe(true);
    expect(
      hasOpenToolFence(formatToolCallBlock({ id: "1", name: "x", arguments: {} }))
    ).toBe(false);
  });

  it("pairs tool call and result into one segment", () => {
    const call = { id: "c1", name: "grep_library", arguments: { pattern: "foo" } };
    const result = { id: "c1", result: { count: 1 }, isError: false };
    const answer = `Intro\n${formatToolCallBlock(call)}${formatToolResultBlock(result)}\nDone`;
    const segments = parseAnswerSegments(answer);
    expect(segments).toHaveLength(3);
    expect(segments[0]).toMatchObject({ type: "markdown", content: "Intro" });
    expect(segments[1]).toMatchObject({
      type: "tool",
      call,
      pending: false,
    });
    expect(segments[2]).toMatchObject({ type: "markdown", content: "Done" });
  });
});
