import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBackToClose, clearStaleOverlayEntry } from "../useBackToClose";

/** Let the hook's deferred "remove our entry" task run. */
const flushPendingPop = () => act(async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
});

beforeEach(async () => {
  localStorage.clear();
  // The deferred pop is module-level state, so drain any left pending by the
  // previous test before resetting history.
  await flushPendingPop();
  // Reset to a known, marker-free entry between tests.
  window.history.replaceState(null, "");
});

/** The system Back gesture: pops the entry, then notifies listeners. */
const pressBack = () =>
  act(() => {
    window.history.replaceState(null, "");
    window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
  });

describe("useBackToClose", () => {
  it("pushes a history entry for as long as the overlay is mounted", () => {
    expect(window.history.state?.overlay).toBeUndefined();

    const { unmount } = renderHook(() => useBackToClose(vi.fn()));
    expect(window.history.state?.overlay).toBe(true);
    unmount();
  });

  it("closes the overlay when Back pops the entry", () => {
    const onClose = vi.fn();
    renderHook(() => useBackToClose(onClose));

    pressBack();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("cleans its entry off the stack when closed another way", async () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const { unmount } = renderHook(() => useBackToClose(vi.fn()));

    // Escape / Cancel / backdrop / save all close without a Back press, so the
    // pushed entry must be dropped — otherwise the next Back press is swallowed
    // dismissing an overlay that is already gone.
    unmount();
    await flushPendingPop();
    expect(back).toHaveBeenCalledOnce();
    back.mockRestore();
  });

  it("does not double-pop when Back itself did the closing", async () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const onClose = vi.fn();
    const { unmount } = renderHook(() => useBackToClose(onClose));

    pressBack(); // pops our entry and fires onClose
    unmount(); // the app unmounts the overlay in response
    await flushPendingPop();
    expect(back).not.toHaveBeenCalled();
    back.mockRestore();
  });

  it("reuses the pending entry when an overlay remounts immediately", async () => {
    // This is the StrictMode case (mount → unmount → remount in development),
    // and also a user reopening at once. Popping synchronously in cleanup would
    // race the remount and land on a non-overlay entry, closing the dialog the
    // instant it opened.
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const onClose = vi.fn();
    const first = renderHook(() => useBackToClose(vi.fn()));
    const lengthWithOneOverlay = window.history.length;
    first.unmount();
    const second = renderHook(() => useBackToClose(onClose));
    await flushPendingPop();

    // No second entry stacked, nothing popped, and the overlay is still open.
    expect(window.history.length).toBe(lengthWithOneOverlay);
    expect(back).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(window.history.state?.overlay).toBe(true);
    second.unmount();
    back.mockRestore();
  });

  it("ignores a popstate that lands on another overlay entry", () => {
    const onClose = vi.fn();
    renderHook(() => useBackToClose(onClose));

    // A previous overlay's queued cleanup traversal catching up after this one
    // opened pops the NEW entry and lands on one that is still an overlay's —
    // closing here would slam the just-opened overlay shut.
    act(() => {
      window.history.replaceState({ overlay: true }, "");
      window.dispatchEvent(
        new PopStateEvent("popstate", { state: { overlay: true } })
      );
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("uses the latest onClose without re-pushing an entry", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ cb }) => useBackToClose(cb), {
      initialProps: { cb: first },
    });
    rerender({ cb: second });

    pressBack();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });
});

describe("clearStaleOverlayEntry", () => {
  it("drops a marker left behind by a reload or restored tab", () => {
    // history.state survives a reload, and mobile browsers routinely discard and
    // restore a backgrounded tab. Left in place, the marker would make the
    // hook's guard decline to close and quietly eat a whole Back press.
    window.history.replaceState({ overlay: true }, "");
    clearStaleOverlayEntry();
    expect(window.history.state?.overlay).toBeUndefined();
  });

  it("leaves a clean history alone", () => {
    window.history.replaceState({ something: "else" }, "");
    clearStaleOverlayEntry();
    expect(window.history.state).toEqual({ something: "else" });
  });
});
