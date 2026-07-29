import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBackToClose } from "../useBackToClose";

beforeEach(() => {
  localStorage.clear();
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
  it("pushes a history entry only while the overlay is open", () => {
    const { rerender } = renderHook(
      ({ open }) => useBackToClose(open, vi.fn()),
      { initialProps: { open: false } }
    );
    expect(window.history.state?.overlay).toBeUndefined();

    rerender({ open: true });
    expect(window.history.state?.overlay).toBe(true);
  });

  it("closes the overlay when Back pops the entry", () => {
    const onClose = vi.fn();
    renderHook(() => useBackToClose(true, onClose));

    pressBack();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not close while the overlay is shut — Back stays the browser's", () => {
    const onClose = vi.fn();
    renderHook(() => useBackToClose(false, onClose));

    pressBack();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("cleans its entry off the stack when closed another way", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const { rerender } = renderHook(
      ({ open }) => useBackToClose(open, vi.fn()),
      { initialProps: { open: true } }
    );

    // Escape / Cancel / backdrop / save all close without a Back press, so the
    // pushed entry must be dropped — otherwise the next Back press is swallowed
    // dismissing an overlay that is already gone.
    rerender({ open: false });
    expect(back).toHaveBeenCalledOnce();
    back.mockRestore();
  });

  it("does not double-pop when Back itself did the closing", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const onClose = vi.fn();
    const { rerender } = renderHook(
      ({ open }) => useBackToClose(open, onClose),
      { initialProps: { open: true } }
    );

    pressBack(); // pops our entry and fires onClose
    rerender({ open: false }); // the app closes the sheet in response
    expect(back).not.toHaveBeenCalled();
    back.mockRestore();
  });

  it("clears a marker left over from a reload so it can't eat a Back press", () => {
    // A reload (or a mobile browser discarding and restoring a backgrounded tab)
    // while the sheet was open brings the app back closed, but with our marker
    // still on the current entry.
    window.history.replaceState({ overlay: true }, "");

    const { rerender } = renderHook(
      ({ open }) => useBackToClose(open, vi.fn()),
      { initialProps: { open: false } }
    );
    expect(window.history.state?.overlay).toBeUndefined();

    // With the stale marker gone, reopening and pressing Back closes on the
    // first press rather than being absorbed by the leftover entry.
    const onClose = vi.fn();
    rerender({ open: true } as never);
    renderHook(() => useBackToClose(true, onClose));
    pressBack();
    expect(onClose).toHaveBeenCalled();
  });

  it("ignores a popstate that lands on another overlay entry", () => {
    const onClose = vi.fn();
    renderHook(() => useBackToClose(true, onClose));

    // A queued cleanup traversal catching up after the sheet was reopened pops
    // the NEW entry and lands on one that is still ours — closing here would
    // slam the just-opened sheet shut.
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
    const { rerender } = renderHook(
      ({ cb }) => useBackToClose(true, cb),
      { initialProps: { cb: first } }
    );
    rerender({ cb: second });

    pressBack();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });
});
