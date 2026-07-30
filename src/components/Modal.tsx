// src/components/Modal.tsx
// Accessible modal shell shared by every confirm/edit dialog. Implements the
// WAI-ARIA APG dialog pattern in one place so behaviour can't drift between
// callers: labelled dialog role, Escape to close, backdrop-click to close,
// a focus trap (Tab/Shift+Tab wrap inside), initial focus, and focus restored
// to the opener on close.
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useBackToClose } from "../hooks/useBackToClose";

// Elements that can receive keyboard focus. Excludes tabindex="-1" (e.g. the
// visually-hidden file input) so the trap only cycles real, reachable controls.
const FOCUSABLE =
  'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

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

    const target =
      initialFocusRef?.current ??
      dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE) ??
      null;
    target?.focus();

    return () => {
      // Lift inert FIRST, or the focus calls below hit an unfocusable subtree.
      root?.removeAttribute("inert");
      document.body.style.overflow = overflow;
      // If the opener was removed while the dialog was open (a confirm deleted
      // its row), focusing it is a no-op that drops focus to <body>; fall back to
      // a logical location instead.
      if (restoreTarget?.isConnected) {
        restoreTarget.focus();
      } else {
        fallbackTarget?.focus();
      }
    };
    // Mount/unmount only — the refs are read at open and close respectively.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape closes. Hold the latest onClose in a ref so the window listener is
  // subscribed once, not re-added on every render when callers pass a fresh
  // inline onClose. (This is React's recommended stable pattern; useEffectEvent
  // is still experimental.)
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Keep Tab focus inside the dialog (aria-modal is advisory only).
  const trapTab = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

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
      {/* onKeyDown here is the focus trap, not a widget interaction. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        className={`dialog dialog--${variant}${offscreen ? " is-closed" : ""}${
          closing ? " is-closing" : ""
        }`}
        ref={dialogRef}
        onKeyDown={trapTab}
      >
        {children}
      </div>
    </div>,
    document.body
  );
};
