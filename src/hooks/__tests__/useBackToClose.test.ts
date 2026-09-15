import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBackToClose, clearStaleOverlayEntry } from "../useBackToClose";

/** Let the hook's deferred "remove our entry" task run. */
const flushPendingPop = () => act(async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
});

beforeEach(async () => {
  localStorage.clear();
  // Reset to a known, marker-free entry FIRST, then drain — not the other way
  // round. The deferred reconciliation is module-level, so the previous test
  // can still have one pending; draining it against that test's leftover state
  // sent a real, ASYNCHRONOUS jsdom traversal that then landed in the middle of
  // this one, quietly removing an entry it had just pushed. Resetting first
  // means the drained reconciliation finds nothing to do.
  window.history.replaceState(null, "");
  await flushPendingPop();
  window.history.replaceState(null, "");
});

/**
 * How far the hook traverses the history stack, whichever call it uses.
 *
 * The traversal is what matters — entries left behind swallow a later Back
 * press — so the assertion is the distance, not the method name.
 */
function trackTraversal(): () => number {
  let total = 0;
  // Modelled, not merely counted. A stub that only tallies the call is not a
  // traversal: a real one lands on a different entry and fires `popstate`, and
  // the hook uses that event to know its traversal completed. Counting alone
  // left the module believing a traversal was still in flight FOREVER, which
  // then leaked into later tests in this file and made one of them measure a
  // smaller traversal than the code actually performs.
  const traverse = (delta: number) => {
    total += delta;
    window.history.replaceState(null, "");
    window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
  };
  vi.spyOn(window.history, "back").mockImplementation(() => traverse(-1));
  vi.spyOn(window.history, "go").mockImplementation((delta?: number) =>
    traverse(delta ?? 0),
  );
  return () => total;
}

afterEach(async () => {
  // Drain while the spies are still installed, so no traversal escapes into
  // real jsdom history and lands during the next test.
  await flushPendingPop();
  vi.restoreAllMocks();
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
    // Asserted as HOW FAR it traverses, not as which method it called. The
    // earlier version spied on `history.back` and so was really testing the
    // mechanism — it went red when the traversal became a single `go(-n)`,
    // which removes the same entries for the same reason.
    const traversed = trackTraversal();
    const { unmount } = renderHook(() => useBackToClose(vi.fn()));

    // Escape / Cancel / backdrop / save all close without a Back press, so the
    // pushed entry must be dropped — otherwise the next Back press is swallowed
    // dismissing an overlay that is already gone.
    unmount();
    await flushPendingPop();
    expect(traversed()).toBe(-1);
  });

  it("drops both entries when two overlays close in the same commit", async () => {
    // One deferred task served every overlay through a single module slot, so
    // the second cleanup overwrote the first WITHOUT cancelling its timer. Both
    // ran, the orphan consumed the wrong entry, and one was stranded on the
    // stack for the rest of the session — silently eating a later Back press.
    const traversed = trackTraversal();
    const outer = renderHook(() => useBackToClose(vi.fn()));
    const inner = renderHook(() => useBackToClose(vi.fn()));

    outer.unmount();
    inner.unmount();
    await flushPendingPop();

    expect(traversed()).toBe(-2);
  });

  it("does not double-pop when Back itself did the closing", async () => {
    const traversed = trackTraversal();
    const onClose = vi.fn();
    const { unmount } = renderHook(() => useBackToClose(onClose));

    pressBack(); // pops our entry and fires onClose
    unmount(); // the app unmounts the overlay in response
    await flushPendingPop();
    expect(traversed()).toBe(0);
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
    // Another overlay's entry means one at or below this one's own depth — an
    // OUTER dialog's. Landing on an entry deeper than ours is not a reason to
    // stay open; landing on one that still covers us is.
    act(() => {
      window.history.replaceState({ overlay: true, depth: 9 }, "");
      window.dispatchEvent(
        new PopStateEvent("popstate", { state: { overlay: true, depth: 9 } })
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
