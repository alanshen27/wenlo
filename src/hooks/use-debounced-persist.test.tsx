/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebouncedFlush, useDebouncedPersist } from "./use-debounced-persist";

function renderHook<T>(useHook: () => T) {
  const container = document.createElement("div");
  const root: Root = createRoot(container);
  const result = { current: undefined as T };

  function HookHost() {
    result.current = useHook();
    return null;
  }

  act(() => {
    root.render(<HookHost />);
  });

  return {
    result,
    unmount: () => act(() => root.unmount()),
  };
}

describe("useDebouncedFlush", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces flush calls", () => {
    const flush = vi.fn();
    const { result, unmount } = renderHook(() => useDebouncedFlush(flush, 600));

    act(() => {
      result.current.schedule();
      result.current.schedule();
    });

    expect(flush).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(flush).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("flushNow runs immediately", () => {
    const flush = vi.fn();
    const { result, unmount } = renderHook(() => useDebouncedFlush(flush, 600));

    act(() => {
      result.current.schedule();
      result.current.flushNow();
    });

    expect(flush).toHaveBeenCalledTimes(1);
    unmount();
  });
});

describe("useDebouncedPersist", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("persists dirty payloads after debounce", async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const markSaving = vi.fn();
    const markSaved = vi.fn();
    const markError = vi.fn();

    const { result, unmount } = renderHook(() =>
      useDebouncedPersist({
        debounceMs: 300,
        getPayload: () => ({ value: 1 }),
        persist,
        markSaving,
        markSaved,
        markError,
      })
    );

    act(() => {
      result.current.markDirty();
    });

    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(markSaving).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith({ value: 1 });
    expect(markSaved).toHaveBeenCalledTimes(1);
    expect(markError).not.toHaveBeenCalled();
    unmount();
  });
});
