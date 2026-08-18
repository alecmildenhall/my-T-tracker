// src/hooks/useSwipeBack.ts
// A left-to-right swipe moves one destination back — History → Home,
// Settings → History. Phone-only by nature: it listens for touches, so a mouse
// never triggers it and the tab bar remains the way everything else navigates.
//
// WHY A GESTURE AND NOT HISTORY ENTRIES. The other way to do this is to push a
// `history.pushState` entry per tab change, and let the platform's own back —
// iOS edge swipe, Android gesture, desktop back button — pop it. That is more
// native, works with muscle memory this code cannot see, and needs no gesture
// maths at all. It was not taken here for one reason: `useBackToClose` already
// owns a history entry for the open sheet, and the close path it hangs off is
// the most defect-dense function in this codebase. Interleaving a second
// pushState owner with it is exactly the shape that has produced repeat bugs.
// A self-contained gesture touches none of that. If tab history is ever wanted
// for real — deep links, a PWA with routing — do it there, once, and delete
// this.
import { useEffect } from "react";

/** How far the thumb must travel before it counts as a swipe rather than a tap
 *  that wandered. Roughly a fifth of a phone screen. */
const MIN_DISTANCE_PX = 72;

/** Horizontal dominance. A back swipe is sideways; scrolling a long list is not,
 *  and the two must never be confused, because one of them loses your place. */
const DOMINANCE = 1.8;

/** Past this it is a drag, not a flick — someone resting a finger and moving it
 *  while reading should not be navigated away from. */
const MAX_DURATION_MS = 700;

/** Controls where a horizontal drag means something else entirely: moving the
 *  caret, or selecting text. */
const IGNORED = "input, textarea, select, [contenteditable]";

/**
 * Calls `onBack` when the user swipes left-to-right.
 *
 * `enabled` is how the caller says "there is somewhere to go back to, and
 * nothing is covering the screen" — pass false on the first tab and whenever a
 * dialog is open, since the sheet renders through a portal and would otherwise
 * catch swipes meant for the form inside it.
 */
export function useSwipeBack(enabled: boolean, onBack: () => void): void {
  useEffect(() => {
    if (!enabled) return;

    let startX = 0;
    let startY = 0;
    let startedAt = 0;
    let tracking = false;

    const cancel = () => {
      tracking = false;
    };

    const onTouchStart = (e: TouchEvent) => {
      // One finger only: two is a pinch, and zooming sideways is not a swipe.
      if (e.touches.length !== 1) return cancel();
      const touch = e.touches[0];
      const target = touch.target;
      if (target instanceof Element && target.closest(IGNORED)) return cancel();
      startX = touch.clientX;
      startY = touch.clientY;
      startedAt = performance.now();
      tracking = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      // A second finger arriving mid-gesture retires it.
      if (e.touches.length !== 1) cancel();
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (dx < MIN_DISTANCE_PX) return;
      if (Math.abs(dx) < Math.abs(dy) * DOMINANCE) return;
      if (performance.now() - startedAt > MAX_DURATION_MS) return;
      onBack();
    };

    // Passive: this never calls preventDefault. Scrolling must stay smooth, and
    // an edge swipe that the browser decides to claim for its own back
    // navigation should be allowed to — we hear `touchcancel` and stand down,
    // rather than both of us acting on the same gesture.
    const opts = { passive: true } as const;
    window.addEventListener("touchstart", onTouchStart, opts);
    window.addEventListener("touchmove", onTouchMove, opts);
    window.addEventListener("touchend", onTouchEnd, opts);
    window.addEventListener("touchcancel", cancel, opts);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", cancel);
    };
  }, [enabled, onBack]);
}
