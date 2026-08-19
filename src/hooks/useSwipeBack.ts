// src/hooks/useSwipeBack.ts
// A left-to-right swipe goes to Home, from anywhere. Phone-only by nature: it
// listens for touches, so a mouse never triggers it and the tab bar remains the
// way everything else navigates.
//
// HOME FROM ANYWHERE, not "one destination back" — which is what this comment
// used to say, describing a first version that stepped the tab order and so
// sent Settings → History. That treats three destinations as a sequence: you
// never arrive at Settings *from* History, so it was sideways being called
// back. Home is the root and the primary action, one destination is the whole
// rule, and there is no order to memorise.
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
import { useEffect, useRef } from "react";

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
 * Any dialog currently on screen.
 *
 * Asked of the DOM at the moment of the gesture rather than tracked in state,
 * and that is the whole point. The first version took a boolean from App, which
 * knew only about the log sheet — so a swipe over the delete confirm, the rename
 * confirm or the import confirm navigated the screen out from under them,
 * taking the decision away undecided and stranding focus on `<body>`. A
 * registry every dialog must remember to join has the same shape as a list of
 * reasons something cannot happen: the list is never complete. `role="dialog"`
 * is on the overlay `Modal` renders, so this cannot be forgotten by a dialog
 * that does not exist yet.
 */
const anyDialogOpen = () => document.querySelector('[role="dialog"]') !== null;

/**
 * What is selected right now, as a comparable value.
 *
 * Compared across the gesture rather than tested at the end of it. "Is anything
 * selected?" is a different question from "did this drag select something", and
 * only the second is a reason not to navigate: long-press a word in a note to
 * read it, then swipe anywhere on screen, and the first answer swallows the
 * gesture for as long as the selection survives — which reads as the swipe
 * being broken, not as the app protecting a selection. Dragging a handle
 * sideways changes what is selected, so the comparison still catches the case
 * this was written for, and stops catching the case it wasn't.
 */
const selectionSnapshot = () => String(window.getSelection() ?? "");

/**
 * Calls `onBack` when the user swipes left-to-right.
 *
 * `enabled` means only "there is somewhere to go back to" — App passes
 * `view !== "home"` and nothing else.
 *
 * It is deliberately NOT where dialogs are handled, though this doc used to
 * tell callers to pass false "whenever a dialog is open". That is a list a
 * caller has to keep complete — the log sheet, the delete confirm, the rename
 * dialog, whatever slice C adds — and the moment it falls behind, a swipe over
 * an open dialog navigates the screen out from under it. The hook asks the DOM
 * itself (`anyDialogOpen`), which cannot fall behind, so a caller enumerating
 * dialogs here is a caller reintroducing the bug that design closed.
 */
export function useSwipeBack(enabled: boolean, onBack: () => void): void {
  // Held in a ref so the effect subscribes ONCE. Callers pass a fresh arrow
  // every render (`() => navigate("home")`), so with the callback in the
  // dependency list any re-render tore the listeners down and rebuilt them —
  // and the gesture's own state lives in the effect's locals, so an in-flight
  // swipe was silently reset to nothing. A cross-tab storage sync or the
  // storage banner appearing during the ~200-700ms of a swipe was enough. The
  // same pattern `Modal` and `useBackToClose` already use, for the same reason.
  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  });

  useEffect(() => {
    if (!enabled) return;

    let startX = 0;
    let startY = 0;
    let startedAt = 0;
    let startSelection = "";
    let tracking = false;

    const cancel = () => {
      tracking = false;
    };

    const onTouchStart = (e: TouchEvent) => {
      // One finger only: two is a pinch, and zooming sideways is not a swipe.
      if (e.touches.length !== 1) return cancel();
      if (anyDialogOpen()) return cancel();
      const touch = e.touches[0];
      const target = touch.target;
      if (target instanceof Element && target.closest(IGNORED)) return cancel();
      startX = touch.clientX;
      startY = touch.clientY;
      startedAt = performance.now();
      startSelection = selectionSnapshot();
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
      // Re-asked at the END too: a dialog can open mid-gesture, and the check
      // that matters is the state of the screen when the gesture would act.
      if (anyDialogOpen()) return;
      // The drag changed what was selected, so it was a text drag.
      if (selectionSnapshot() !== startSelection) return;
      onBackRef.current();
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
    // `enabled` only — see onBackRef above.
  }, [enabled]);
}
