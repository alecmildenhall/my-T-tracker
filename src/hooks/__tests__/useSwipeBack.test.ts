import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSwipeBack } from "../useSwipeBack";

/**
 * jsdom has no TouchEvent constructor, so the sequence is built by hand. Only
 * the fields the hook reads are supplied — clientX/clientY, and the lists it
 * counts — which keeps the fixture honest about what the code actually depends
 * on.
 */
const touch = (x: number, y: number, target: EventTarget = document.body) =>
  ({ clientX: x, clientY: y, target }) as unknown as Touch;

const fire = (
  type: string,
  touches: Touch[],
  changedTouches: Touch[] = touches
) => {
  const e = new Event(type) as TouchEvent & { touches: Touch[] };
  Object.assign(e, { touches, changedTouches });
  window.dispatchEvent(e);
};

/** A whole gesture: down at (x1,y1), up at (x2,y2). */
const swipe = (x1: number, y1: number, x2: number, y2: number) => {
  fire("touchstart", [touch(x1, y1)]);
  fire("touchend", [], [touch(x2, y2)]);
};

afterEach(() => vi.useRealTimers());

describe("useSwipeBack", () => {
  it("fires on a clear left-to-right swipe", () => {
    const onBack = vi.fn();
    renderHook(() => useSwipeBack(true, onBack));
    swipe(40, 400, 200, 410);
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("ignores a swipe the other way", () => {
    // Back is one direction. Forward would need somewhere to go and a second
    // rule to learn, and was not asked for.
    const onBack = vi.fn();
    renderHook(() => useSwipeBack(true, onBack));
    swipe(300, 400, 100, 405);
    expect(onBack).not.toHaveBeenCalled();
  });

  it("ignores a scroll that drifts sideways", () => {
    // The failure that would matter most: losing your place in a long list
    // because a downward flick wandered 80px right.
    const onBack = vi.fn();
    renderHook(() => useSwipeBack(true, onBack));
    swipe(40, 200, 130, 620);
    expect(onBack).not.toHaveBeenCalled();
  });

  it("ignores a tap that wandered a little", () => {
    const onBack = vi.fn();
    renderHook(() => useSwipeBack(true, onBack));
    swipe(40, 400, 90, 402);
    expect(onBack).not.toHaveBeenCalled();
  });

  it("ignores a slow drag", () => {
    // Someone resting a finger and moving it while reading is not navigating.
    vi.useFakeTimers();
    const onBack = vi.fn();
    renderHook(() => useSwipeBack(true, onBack));
    fire("touchstart", [touch(40, 400)]);
    vi.advanceTimersByTime(1500);
    fire("touchend", [], [touch(300, 400)]);
    expect(onBack).not.toHaveBeenCalled();
  });

  it("ignores a two-finger gesture, and one that gains a second finger", () => {
    const onBack = vi.fn();
    renderHook(() => useSwipeBack(true, onBack));
    fire("touchstart", [touch(40, 400), touch(80, 400)]);
    fire("touchend", [], [touch(300, 400)]);
    expect(onBack).not.toHaveBeenCalled();

    fire("touchstart", [touch(40, 400)]);
    fire("touchmove", [touch(60, 400), touch(120, 400)]);
    fire("touchend", [], [touch(300, 400)]);
    expect(onBack).not.toHaveBeenCalled();
  });

  it("stands down when the browser claims the gesture", () => {
    // An edge swipe the browser decides is its own back navigation: it cancels
    // our touches, and both of us acting on one gesture is how you end up two
    // screens away.
    const onBack = vi.fn();
    renderHook(() => useSwipeBack(true, onBack));
    fire("touchstart", [touch(2, 400)]);
    fire("touchcancel", []);
    fire("touchend", [], [touch(300, 400)]);
    expect(onBack).not.toHaveBeenCalled();
  });

  it("leaves text fields alone", () => {
    // Dragging sideways in an input moves the caret or selects — a different
    // gesture with a different meaning, on the same pixels.
    const input = document.createElement("input");
    document.body.appendChild(input);
    const onBack = vi.fn();
    renderHook(() => useSwipeBack(true, onBack));
    fire("touchstart", [touch(40, 400, input)]);
    fire("touchend", [], [touch(300, 400, input)]);
    expect(onBack).not.toHaveBeenCalled();
    input.remove();
  });

  it("does nothing at all when disabled", () => {
    // How the caller says "nothing to go back to" (Home) or "something is
    // covering the screen" (an open sheet).
    const onBack = vi.fn();
    renderHook(() => useSwipeBack(false, onBack));
    swipe(40, 400, 300, 405);
    expect(onBack).not.toHaveBeenCalled();
  });

  it("unsubscribes on unmount", () => {
    const onBack = vi.fn();
    const { unmount } = renderHook(() => useSwipeBack(true, onBack));
    unmount();
    swipe(40, 400, 300, 405);
    expect(onBack).not.toHaveBeenCalled();
  });
});
