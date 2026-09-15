// src/components/Modal.tsx
// Accessible modal shell shared by every confirm/edit dialog. Implements the
// WAI-ARIA APG dialog pattern in one place so behaviour can't drift between
// callers: labelled dialog role, Escape to close, backdrop-click to close,
// a focus trap (Tab/Shift+Tab wrap inside, via useFocusTrap), initial focus, and
// focus restored to the opener on close.
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useBackToClose } from "../hooks/useBackToClose";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { syncModality } from "../utils/dialogStack";
import { handOffFocus } from "../utils/focus";
import { tabbablesIn } from "../utils/tabbing";

interface ModalProps {
  /** id of the heading element inside, for aria-labelledby. */
  labelledBy: string;
  /** Close request (Escape, backdrop click). The parent owns open/closed state. */
  onClose: () => void;
  /** Element to focus on open. Defaults to the first focusable in the dialog.
   *  Destructive dialogs should point this at Cancel; editors at their input. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /** Element to focus on close. Defaults to whatever was focused before opening
   *  (the opener). Set it when the opener isn't reliably focused (e.g. a dialog
   *  triggered by a file-input change rather than a button click). */
  restoreFocusRef?: React.RefObject<HTMLElement | null>;
  /** Where focus goes on close when the opener no longer exists — e.g. a confirm
   *  action removed the row that opened the dialog. Per the WAI-ARIA APG, focus
   *  should land on a logical location rather than falling to <body>. */
  fallbackFocusRef?: React.RefObject<HTMLElement | null>;
  /** Presentation only — the behaviour (focus trap, Escape, restore) is identical.
   *  "dialog" is the compact centred confirm box; "sheet" fills the phone screen
   *  for long content like the shot form, where a small centred box would scroll
   *  awkwardly inside a scrolling page. */
  variant?: "dialog" | "sheet";
  /** True while the parent is playing the exit animation before unmounting. Only
   *  the sheet variant animates; a compact confirm dialog appears at once. */
  closing?: boolean;
  children: React.ReactNode;
}

/** How long the sheet's exit transition runs — must match styles.css. Exported
 *  so the parent can hold the dialog mounted for exactly that long.
 *
 *  240, not 200: across a full-screen surface, 200ms means the sheet is moving
 *  fastest at the instant it disappears, which reads as dropped rather than
 *  dismissed. Material's own scale steps 200 → 250 and this sits between them
 *  deliberately — 230/240/245 were compared and 240 was the one that stopped
 *  looking dropped without starting to feel slow. Don't "correct" it to a token.
 *
 *  KNOWN, AND DEFERRED ON PURPOSE: waiting this out with a `setTimeout` is a
 *  proxy for "the transition ended", which is the habit CLAUDE.md warns about.
 *  Observing `transitionend` instead cannot simply replace it — that event does
 *  not fire for a 0s duration, for a transition that never starts, or where
 *  transitions are disabled, and a missed one leaves the sheet mounted forever
 *  over an inert `#root`. So the timer stays as the net either way, and the
 *  gain is precision rather than one less constant. See the UI-overhaul item in
 *  README.md for when to do it and what shape it takes. */
export const SHEET_EXIT_MS = 240;

export const Modal: React.FC<ModalProps> = ({
  labelledBy,
  onClose,
  initialFocusRef,
  restoreFocusRef,
  fallbackFocusRef,
  variant = "dialog",
  closing = false,
  children,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  // The sheet must paint once in its off-screen state before transitioning in,
  // or the browser has nothing to animate from. Two frames: the first commits
  // the pre-entry styles, the second flips them. Focus never waits on this — the
  // dialog is usable from the first frame; the motion is decoration over it.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, []);

  // Off-screen before entering and again while leaving.
  const offscreen = !entered || closing;

  // Every dialog, not just the shot sheet: the rename/remove confirms and the
  // "Replace your data?" import confirm would otherwise let a reflexive Back
  // exit the app outright — from one tap away from a destructive restore. A
  // mounted Modal *is* an open overlay, so wiring it here means no caller can
  // forget. Escape (below) and Back now agree on what dismissal means.
  useBackToClose(onClose, dialogRef);

  // Focus and modality live in ONE effect, deliberately.
  //
  // Everything the page-level lock covers — `inert`, `--sheet-h`, the body
  // scroll lock — is now DERIVED from the dialog registry rather than owned
  // here. The scroll lock was the last holdout and looked like the safe one,
  // because capturing and restoring the previous value means each instance puts
  // back exactly what it found. That is safe only while dialogs close one at a
  // time; see `dialogStack.ts` for what it did when two closed together.
  //
  // They are combined because the ORDER of the teardown matters: `inert` makes
  // its whole subtree unfocusable, so restoring focus to the opener before
  // lifting inert silently fails and focus lands nowhere useful. Splitting these
  // into two effects made that ordering an accident of declaration order — and
  // jsdom ignores `inert` entirely, so no unit test would notice.
  // Deliberately a PASSIVE effect, not a layout one, and the teardown is why.
  //
  // Cleanup runs after the commit, so between React removing the dialog's DOM
  // and this restore running, focus sits briefly on <body>. Moving it to
  // `useLayoutEffect` closes that gap and was tried — it breaks something more
  // important. Layout cleanup runs during the mutation phase, before React has
  // finished removing the rest of the tree, so `restoreTarget.isConnected` still
  // reports true for an opener that is about to vanish: a confirm dialog that
  // deleted its own row then restored focus to that row's button, which React
  // removed a moment later, landing focus nowhere. The whole point of the
  // restore/fallback split is knowing which of those happened, and only the
  // settled DOM can answer.
  //
  // So the transit through <body> is accepted. It is sub-frame in a browser, and
  // it is why tests must wait for focus to SETTLE rather than for the dialog to
  // disappear — see `expectFocusSettled` in src/test/focus.ts.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    // The restore target (a persistent opener like the Import button, or else
    // whatever had focus) is captured now, at open, so the cleanup doesn't read
    // a ref that may have changed.
    const restoreTarget = restoreFocusRef?.current ?? previouslyFocused;
    const fallbackTarget = fallbackFocusRef?.current ?? null;

    // Everything stack-scoped — `inert` on `#root`, `inert` on any dialog now
    // underneath this one, the `--sheet-h` viewport track, the body scroll lock — is recomputed from
    // the registry rather than set by this instance, so a second dialog
    // composes instead of overwriting. This dialog is already registered:
    // `useFocusTrap` joins the stack in a LAYOUT effect, which the whole tree's
    // layout phase runs before any passive effect, including this one.
    syncModality();

    // Opening is a hand-off too: the element that had focus is inside the root
    // just marked inert, so anything short of landing INSIDE the dialog drops
    // focus to <body> and leaves Escape as the only way out. This was a `??`
    // chain, which falls through on a null candidate but not on a candidate that
    // refused focus — so an initialFocusRef pointing at something not yet
    // focusable failed silently and skipped both fallbacks. Last resort is the
    // dialog itself, per the WAI-ARIA APG.
    // Every focusable in turn, not just the first: `querySelector` gave a single
    // candidate, so if both the initialFocusRef and that one control refused
    // focus — a disabled Cancel on a confirm dialog is the realistic case —
    // focus fell straight through to the container, leaving the user on a
    // tabIndex -1 div with nothing announced. Same walk the Tab trap does.
    handOffFocus(
      initialFocusRef,
      ...(dialogRef.current ? tabbablesIn(dialogRef.current) : []),
      dialogRef
    );

    return () => {
      // Re-derive FIRST, or the focus calls below hit an unfocusable subtree.
      // By now this dialog has already LEFT the registry — layout cleanups run
      // during the commit, passive ones after — so the recomputation sees the
      // stack as it will be: `#root` goes live again only if nothing is left,
      // and the dialog beneath loses its `inert` in time to receive focus back.
      syncModality();
      // The opener, then a logical location if it is gone — a confirm dialog
      // routinely deletes the row that opened it, and on Safari the "opener" is
      // often <body> to begin with, since tapping a <button> there doesn't focus
      // it. handOffFocus skips both cases and verifies the result.
      handOffFocus(restoreTarget, fallbackTarget);
    };
    // Mount/unmount only — the refs are read at open and close respectively.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tab containment and Escape both live in useFocusTrap: they share the same
  // question ("is this the dialog the keyboard belongs to right now?"), and
  // keeping them together is what lets a dialog opened from inside another one
  // behave — only the topmost closes, and only the topmost traps.
  useFocusTrap(dialogRef, { onEscape: onClose });

  // Portaled to <body> so it sits OUTSIDE the app root — which is what lets the
  // root be marked inert without disabling the dialog itself.
  return createPortal(
    // The backdrop closes on click as a mouse convenience for the compact
    // confirm dialog; the keyboard equivalent is Escape (handled above), so no
    // key handler is needed here. Sheets opt OUT: they hold a long form, and on
    // desktop the backdrop is most of the viewport — one stray click would throw
    // away everything typed with no warning and no undo. Escape and the system
    // Back gesture still close a sheet, both being deliberate acts rather than a
    // mis-aimed click.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      className={`dialog-overlay dialog-overlay--${variant}${
        offscreen ? " is-closed" : ""
      }${closing ? " is-closing" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      onClick={(e) => {
        if (variant === "sheet") return;
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`dialog dialog--${variant}${offscreen ? " is-closed" : ""}${
          closing ? " is-closing" : ""
        }`}
        ref={dialogRef}
        // Focusable only as the last-resort target below — a dialog whose
        // content holds nothing focusable would otherwise open with focus still
        // outside it, in a subtree that was just marked inert, stranding it on
        // <body>. Both dialogs shipped today focus real content, so this is a
        // guard for the next plain-message dialog, not a live fix.
        tabIndex={-1}
      >
        {children}
      </div>
    </div>,
    document.body
  );
};
