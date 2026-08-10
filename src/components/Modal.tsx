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

// Elements that can receive keyboard focus. Excludes tabindex="-1" (e.g. the
// visually-hidden file input) so the trap only cycles real, reachable controls.
const FOCUSABLE =
  'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

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
 *  so the parent can hold the dialog mounted for exactly that long. */
export const SHEET_EXIT_MS = 200;

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
  // `#root` stays inert across the whole 200ms closing window — so this is a
  // note rather than a guard. The fix, when it is needed, is for the listener to
  // no-op unless its own dialog is the last one mounted.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
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
        const before = nextIdx === -1 ? list : list.slice(0, nextIdx);
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
