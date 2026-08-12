// src/components/Modal.tsx
// Accessible modal shell shared by every confirm/edit dialog. Implements the
// WAI-ARIA APG dialog pattern in one place so behaviour can't drift between
// callers: labelled dialog role, Escape to close, backdrop-click to close,
// a focus trap (Tab/Shift+Tab wrap inside), initial focus, and focus restored
// to the opener on close.
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useBackToClose } from "../hooks/useBackToClose";
import { handOffFocus } from "../utils/focus";

// Elements that can receive keyboard focus.
//
// `tabindex="-1"` is excluded from EVERY clause, not just the last one. Written
// as one string it read `..., textarea, [tabindex]:not([tabindex="-1"])`, so the
// guard bound only to `[tabindex]` — and `button:not([disabled])` happily matched
// a `tabindex="-1"` button. That is the same escape `:not([disabled])` was added
// to close, arriving through a different attribute: the control sits in `list`,
// the segmented-input hatch sees "there is something beyond this" and hands Tab
// to the browser, which skips it and walks off an inert page. Built from an array
// so a new clause cannot quietly miss the guard.
//
// `:not([disabled])` matters more than it looks. A disabled control cannot hold
// focus, but it still matched `button`, so it sat in this list and made every
// index-based question about the list wrong: "is focus on the last control" was
// answered against an element nothing can focus. That produced two separate
// escapes. Filtering at the source is what every tabbability implementation does
// first, and it makes the list mean what its consumers assume it means.
//
// Still not a complete tabbability check — `display: none`, `visibility: hidden`
// and a collapsed <details> also make an element unfocusable and are not
// expressible here. Nothing in this app's dialogs hits those, and `handOffFocus`
// verifies after every move, so the remaining exposure is the index arithmetic
// below. See the roadmap's "the Modal's Tab trap wants its own owner".
const NOT_HIDDEN = ':not([tabindex="-1"])';
const FOCUSABLE = [
  `a[href]${NOT_HIDDEN}`,
  `button:not([disabled])${NOT_HIDDEN}`,
  `input:not([disabled])${NOT_HIDDEN}`,
  `select:not([disabled])${NOT_HIDDEN}`,
  `textarea:not([disabled])${NOT_HIDDEN}`,
  // `:not([disabled])` here too. A control can carry BOTH an explicit tabindex
  // and `disabled` — <button disabled tabIndex={0}> — and this clause matched it
  // on the tabindex alone, which is the same escape the other clauses were fixed
  // for, arriving by a third route.
  `[tabindex]:not([disabled])${NOT_HIDDEN}`,
].join(", ");

/** Inputs whose own Tab handling moves between segments inside the control. */
const SEGMENTED_INPUT =
  'input[type="date"], input[type="time"], input[type="datetime-local"], ' +
  'input[type="month"], input[type="week"]';

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
 *  looking dropped without starting to feel slow. Don't "correct" it to a token. */
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
  useBackToClose(onClose);

  // Focus management and the page lock live in ONE effect, deliberately.
  //
  // `aria-modal` is advisory and the Tab trap only intercepts Tab, so without
  // `inert` a screen-reader or voice-control user can still reach and activate
  // the tab bar rendered after this dialog — switching views underneath an open
  // sheet. `inert` blocks focus, clicks, and AT access in one attribute. The
  // scroll lock stops the list behind a long sheet scrolling away when the
  // form's own scroll reaches its end, leaving the user somewhere else on close.
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
    const root = document.getElementById("root");
    const previouslyFocused = document.activeElement as HTMLElement | null;
    // The restore target (a persistent opener like the Import button, or else
    // whatever had focus) is captured now, at open, so the cleanup doesn't read
    // a ref that may have changed.
    const restoreTarget = restoreFocusRef?.current ?? previouslyFocused;
    const fallbackTarget = fallbackFocusRef?.current ?? null;

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    root?.setAttribute("inert", "");

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
      ...(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []),
      dialogRef
    );

    return () => {
      // Lift inert FIRST, or the focus calls below hit an unfocusable subtree.
      root?.removeAttribute("inert");
      document.body.style.overflow = overflow;
      // The opener, then a logical location if it is gone — a confirm dialog
      // routinely deletes the row that opened it, and on Safari the "opener" is
      // often <body> to begin with, since tapping a <button> there doesn't focus
      // it. handOffFocus skips both cases and verifies the result.
      handOffFocus(restoreTarget, fallbackTarget);
    };
    // Mount/unmount only — the refs are read at open and close respectively.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track the *visual* viewport while a dialog is open, exposed as `--sheet-h`.
  //
  // iOS Safari does not shrink the layout viewport when the on-screen keyboard
  // opens, so a `height: 100%` sheet keeps its full height and the keyboard
  // covers the bottom — which is the pinned Save button, the one thing the
  // three-region layout exists to keep reachable. `visualViewport.height` is the
  // space actually visible, so sizing to it lifts the bar above the keyboard.
  // Android resizes the layout viewport itself, where this is a no-op.
  //
  // Height only, deliberately: the overlay is `position: fixed; inset: 0` and
  // body scroll is locked, so `offsetTop` stays ~0 and reading it would add
  // jitter for no gain. NOTE: verified in Chrome and by unit test, but not yet on
  // real iOS hardware — see the mobile checklist in README.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const apply = () =>
      document.documentElement.style.setProperty("--sheet-h", `${vv.height}px`);
    apply();
    vv.addEventListener("resize", apply);
    return () => {
      vv.removeEventListener("resize", apply);
      document.documentElement.style.removeProperty("--sheet-h");
    };
  }, []);

  // Escape closes. Hold the latest onClose in a ref so the window listener is
  // subscribed once, not re-added on every render when callers pass a fresh
  // inline onClose. (This is React's recommended stable pattern; useEffectEvent
  // is still experimental.)
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  // Escape and the Tab trap, both on the WINDOW rather than on the dialog.
  //
  // The trap used to be the dialog's own onKeyDown, which only fires for keys
  // pressed while focus is inside it — so the one situation it most needed to
  // handle was the one it could not see. Clicking a dialog's non-focusable
  // padding drops focus to <body>; from there the dialog's handler never ran,
  // and with #root inert there was nothing earlier in the document to Tab to, so
  // focus left the page entirely. Verified in a real browser, where the sheet's
  // bottom bar has exactly such dead space beside the Save button; jsdom cannot
  // see it, since it neither lays out padding nor implements `inert`.
  //
  // A document-level listener is what focus-trap, Radix and Reach UI all do, for
  // this reason. `aria-modal` is advisory only, so the trap has to be real.
  //
  // LATENT, if a dialog ever opens a second one: two mounted Modals would both
  // listen, and the outer one would see focus as "outside" and haul it back out
  // of the inner dialog. Not reachable today — the log sheet, the delete
  // confirm, and the saved-values and import dialogs are mutually exclusive, and
  // `#root` stays inert across the whole closing window. The
  // `defaultPrevented` check below makes a second listener harmless rather than
  // additive, which is most of the danger; a full fix still wants the listener
  // to no-op unless its own dialog is the last one mounted.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // A listener can outlive its dialog. React removes the DOM during the
      // commit but runs this passive cleanup afterwards, so in between there is
      // a window where a keydown reaches a Modal whose dialog has already left
      // the document. It then measures a detached subtree — every focusable
      // disconnected, so `handOffFocus` moves nothing — while still having
      // called preventDefault, which makes the LIVE dialog's listener bail on
      // `defaultPrevented` and turns Tab into a no-op. That is the intermittent
      // failure: not a double advance, but no advance at all.
      //
      // Ask whether this dialog is still in the document rather than assuming
      // the listener's lifetime matches its own.
      if (!dialogRef.current?.isConnected) return;

      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      // Already handled. The old trap only acted at the list edges, so a second
      // delivery of the same Tab was a no-op; this one rotates ONE STEP from
      // wherever focus is, so a duplicate delivery advances twice and lands a
      // control further on than the user asked for. Duplicates happen — a stale
      // listener from a dialog whose cleanup has not run yet, and the stacked-
      // dialog case noted below — and the symptom is an intermittently red
      // suite rather than an obvious break.
      if (e.defaultPrevented) return;
      // Ctrl/Alt/Cmd+Tab are the browser's and the OS's, not ours. They still
      // dispatch a Tab keydown to the page, and preventDefault doesn't stop a
      // reserved shortcut — it just meant coming back from another browser tab
      // to find focus silently moved inside the sheet.
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = dialog.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (focusables.length === 0) {
        // A dialog with nothing focusable in it is supported — the open-time
        // chain lands on the container for exactly that case. Without a floor
        // here the handler returned, the default ran, and focus left the page,
        // which is the escape this trap exists to close. Owning Tab has to mean
        // owning it in the empty case too.
        e.preventDefault();
        handOffFocus(dialogRef);
        return;
      }

      // The trap owns Tab entirely while a dialog is open, rather than trying to
      // detect "focus is at the edge" and intervening only there. Edge detection
      // cannot be made reliable: FOCUSABLE matches a DISABLED button, and a
      // hidden one, neither of which can hold focus — so the last element in the
      // list is often not the last element you can actually reach, and comparing
      // against it says "not at the edge" exactly when you are. The default then
      // ran and focus left the dialog for browser chrome, since `#root` is inert
      // and there is nothing else to land on. That was the bug this trap exists
      // to prevent, reintroduced in its own edge check.
      //
      // Building the candidate order instead and letting `handOffFocus` verify
      // each one removes the whole question. It never needs to know WHICH
      // elements can take focus — it tries them in order and stops at the first
      // that does, which is the same principle `focus.ts` is built on.
      // Tab order matches document order here: nothing in this app uses a
      // positive tabIndex, so querySelectorAll's order is the browser's order.
      const list = Array.from(focusables);
      const active = document.activeElement as HTMLElement | null;
      const at = active ? list.indexOf(active) : -1;

      // `input[type=date]` and friends are several controls in one: Tab steps
      // between month, day and year BEFORE leaving the field, and that stepping
      // IS the default action. Owning every Tab cancelled it, so the log sheet's
      // date — required, and the first thing focused in the primary flow — lost
      // segment navigation entirely. Verified in Chrome: outside a dialog three
      // Tabs stay inside the field; inside one, the first Tab left it.
      //
      // Hand Tab back whenever there is still a control beyond this one in the
      // direction of travel, since the browser can then only move within the
      // field or on to that control — either way it stays inside the dialog. At
      // the boundary we take over again, which is where the trap matters.
      //
      // Residual, accepted and bounded: if EVERY control beyond a segmented
      // input were unfocusable, the browser would skip them all and leave. Not
      // reachable here — the sheet's Save button is last and always enabled —
      // and predicting focusability is the thing this file refuses to do.
      if (at !== -1 && active?.matches(SEGMENTED_INPUT)) {
        const beyond = e.shiftKey ? at > 0 : at < list.length - 1;
        if (beyond) return;
      }

      let order: HTMLElement[];
      if (at !== -1) {
        // On one of the controls: rotate from it, and end back on it so that a
        // dialog with a single focusable does nothing rather than escaping.
        const after = list.slice(at + 1);
        const before = list.slice(0, at);
        order = e.shiftKey
          ? [...before.reverse(), ...after.reverse(), list[at]]
          : [...after, ...before, list[at]];
      } else if (active && dialog.contains(active)) {
        // Inside the dialog but not IN the list — a `tabIndex={-1}` element,
        // which FOCUSABLE deliberately excludes. This is not a rare case: it is
        // where every hand-off inside a dialog lands, including "Clear form"
        // moving focus to the sheet's own heading and the container itself.
        //
        // It must not share a branch with "focus is outside". `at === -1` was
        // carrying both meanings, so Tab from the heading restarted at the top
        // of the list — and since the ✕ renders BEFORE the heading, that sent
        // focus backwards. One value, one meaning: ask where this element sits
        // in document order instead of inferring it from a failed lookup.
        const nextIdx = list.findIndex(
          (el) =>
            active.compareDocumentPosition(el) &
            Node.DOCUMENT_POSITION_FOLLOWING
        );
        const after = nextIdx === -1 ? [] : list.slice(nextIdx);
        // `list.slice()`, not `list`. `.reverse()` mutates in place, so aliasing
        // `list` here reverses the array every other branch reads. Harmless only
        // because nothing reads `list` after this point today — and the obvious
        // next edit (appending a floor to the handOffFocus call below, mirroring
        // `list[at]` in the sibling branch) would silently take an element from a
        // reversed array and send focus to the wrong end.
        const before = nextIdx === -1 ? list.slice() : list.slice(0, nextIdx);
        order = e.shiftKey
          ? [...before.reverse(), ...after.reverse()]
          : [...after, ...before];
      } else {
        // Genuinely outside: enter from the appropriate end.
        order = e.shiftKey ? [...list].reverse() : list;
      }

      e.preventDefault();
      handOffFocus(...order, dialogRef);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
