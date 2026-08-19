// src/hooks/useFocusTrap.ts
// Keyboard containment for an open dialog: Tab stays inside, Escape dismisses.
//
// Extracted from Modal because it kept being the thing that broke. Four
// rewrites, each fixing the previous one's escape and introducing the next —
// the wrap target ignored disabled controls; then edge detection ignored them
// too; then owning every Tab conflated "inside on a tabIndex={-1} element" with
// "outside the dialog"; then owning every Tab cancelled `input[type=date]`'s own
// segment stepping. Every one was invisible to jsdom and found in a browser or
// by review. Its own file means its own tests, at the level it actually fails.
//
// The reasoning below is kept from those rounds rather than rewritten. What
// changed is only where the list comes from: `tabbablesIn` asks a real
// tabbability question where a CSS selector used to approximate one.
import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { handOffFocus } from "../utils/focus";
import { tabbablesIn } from "../utils/tabbing";

/** Inputs whose own Tab handling moves between segments inside the control. */
const SEGMENTED_INPUT =
  'input[type="date"], input[type="time"], input[type="datetime-local"], ' +
  'input[type="month"], input[type="week"]';

/**
 * Every dialog currently mounted. An unordered registry, deliberately.
 *
 * Only the topmost may act. Before this, two mounted Modals both listened on
 * the window: the outer one measured focus as "outside" — because it was
 * outside *its* dialog — and hauled it back out of the inner dialog, and both
 * closed on a single Escape. That was recorded as latent rather than fixed
 * because today's dialogs are mutually exclusive. It stops being latent as soon
 * as anything opens a confirm from inside a sheet, which is on the way in B½.
 */
const mounted: HTMLElement[] = [];

/**
 * Is this dialog the one the keyboard belongs to right now?
 *
 * Asked of the DOM, not of the order things registered in. The first version of
 * this was a stack whose last entry was "topmost", and it was **backwards**:
 * React runs a child's effects before its parent's, so a dialog opened from
 * inside another one registers FIRST and the outer dialog ended up claiming the
 * keyboard. Escape closed the wrong dialog and the outer trap pulled focus out
 * of the inner one — the precise bug the stack was added to prevent, rebuilt
 * inside the fix.
 *
 * Document position answers it for both shapes this can take, without knowing
 * which shape it is looking at: real Modals portal to `<body>` and are
 * SIBLINGS, where later in the document is painted on top; a nested dialog is
 * contained by its parent, and containment reports as FOLLOWING too. So
 * "topmost" is simply "no other live dialog comes after me".
 */
const isTopmost = (dialog: HTMLElement | null): boolean =>
  dialog !== null &&
  mounted.every(
    (other) =>
      other === dialog ||
      !other.isConnected ||
      !(
        dialog.compareDocumentPosition(other) &
        Node.DOCUMENT_POSITION_FOLLOWING
      )
  );

interface Options {
  /** Escape, and the Back gesture's equivalent, ask the parent to close. */
  onEscape: () => void;
}

export function useFocusTrap(
  dialogRef: RefObject<HTMLElement | null>,
  { onEscape }: Options
): void {
  // Hold the latest callback so the listeners subscribe once per mount rather
  // than re-adding whenever the caller passes a fresh inline closure.
  const onEscapeRef = useRef(onEscape);
  useEffect(() => {
    onEscapeRef.current = onEscape;
  });

  // Registration is its own effect and runs FIRST, so the dialog is registered
  // before the listeners below ever consult it.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    mounted.push(dialog);
    return () => {
      const at = mounted.indexOf(dialog);
      if (at !== -1) mounted.splice(at, 1);
    };
  }, [dialogRef]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // A listener can outlive its dialog. React removes the DOM during the
      // commit but runs this passive cleanup afterwards, so in between there is
      // a window where a keydown reaches a trap whose dialog has already left
      // the document. It then measures a detached subtree — every candidate
      // disconnected, so `handOffFocus` moves nothing — while still having
      // called preventDefault, which makes the LIVE dialog's listener bail on
      // `defaultPrevented` and turns Tab into a no-op. That is the intermittent
      // failure: not a double advance, but no advance at all.
      const dialog = dialogRef.current;
      if (!dialog?.isConnected) return;
      // ...and a dialog that is merely underneath another one is not the one
      // being typed into.
      if (!isTopmost(dialog)) return;

      if (e.key === "Escape") {
        onEscapeRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      // Already handled. The old trap only acted at the list edges, so a second
      // delivery of the same Tab was a no-op; this one rotates ONE STEP from
      // wherever focus is, so a duplicate delivery advances twice and lands a
      // control further on than the user asked for.
      if (e.defaultPrevented) return;
      // Ctrl/Alt/Cmd+Tab are the browser's and the OS's, not ours. They still
      // dispatch a Tab keydown to the page, and preventDefault doesn't stop a
      // reserved shortcut — it just meant coming back from another browser tab
      // to find focus silently moved inside the sheet.
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const list = tabbablesIn(dialog);
      if (list.length === 0) {
        // A dialog with nothing focusable in it is supported — the open-time
        // chain lands on the container for exactly that case. Without a floor
        // here the handler returned, the default ran, and focus left the page,
        // which is the escape this trap exists to close. Owning Tab has to mean
        // owning it in the empty case too.
        e.preventDefault();
        handOffFocus(dialogRef);
        return;
      }

      // The trap owns Tab entirely while a dialog is open, rather than trying
      // to detect "focus is at the edge" and intervening only there. Building
      // the candidate order and letting `handOffFocus` verify each one removes
      // the question of WHICH element can take focus: it tries them in order
      // and stops at the first that does.
      const active = document.activeElement as HTMLElement | null;
      const at = active ? list.indexOf(active) : -1;

      // `input[type=date]` and friends are several controls in one: Tab steps
      // between month, day and year BEFORE leaving the field, and that stepping
      // IS the default action. Owning every Tab cancelled it, so the log
      // sheet's date lost segment navigation entirely.
      //
      // Hand Tab back whenever there is still a control beyond this one in the
      // direction of travel, since the browser can then only move within the
      // field or on to that control — either way it stays inside the dialog.
      //
      // This question used to be approximate and is now exact: the old selector
      // counted disabled and hidden controls as "beyond", so the browser could
      // be handed a Tab that walked off an inert page. `tabbablesIn` answers
      // for real. What remains, unfixable and accepted, is a segmented input at
      // either END of the order losing stepping in that direction — nothing in
      // the DOM says which segment you are on.
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
        // which tabbable deliberately excludes. This is not a rare case: it is
        // where every hand-off inside a dialog lands, including "Clear form"
        // moving focus to the sheet's own heading, and the container itself.
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
        // `list.slice()`, not `list`. `.reverse()` mutates in place, so
        // aliasing `list` here reverses the array every other branch reads.
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

    // On the WINDOW rather than on the dialog. The trap used to be the dialog's
    // own onKeyDown, which only fires for keys pressed while focus is inside it
    // — so the one situation it most needed to handle was the one it could not
    // see. Clicking a dialog's non-focusable padding drops focus to <body>;
    // from there the dialog's handler never ran, and with #root inert there was
    // nothing earlier in the document to Tab to, so focus left the page
    // entirely. Verified in a real browser; jsdom sees neither the padding nor
    // `inert`. A document-level listener is what focus-trap, Radix and Reach UI
    // all do, for this reason — `aria-modal` is advisory, so the trap has to be
    // real.
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialogRef]);

  // The net. Prediction handles Tab; this catches focus that arrived some other
  // way — a click, a script, an AT gesture, or a Tab whose prediction was wrong
  // in a direction the list could not express.
  //
  // What it deliberately does NOT do is replace the prediction above. With
  // `#root` inert there is nothing after the last dialog control, so a Tab that
  // gets away goes to **browser chrome**, which fires no event here and cannot
  // be clawed back gracefully. Production traps run both halves for exactly
  // this reason; so does this one.
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const dialog = dialogRef.current;
      if (!dialog?.isConnected) return;
      if (!isTopmost(dialog)) return;
      const target = e.target;
      if (!(target instanceof Node) || dialog.contains(target)) return;
      // `<body>` is where focus goes when it goes nowhere, and the keydown path
      // above already treats that as "outside" and re-enters from an end.
      // Pulling it back here as well would fight the close-time restore in the
      // one frame where the dialog is still connected.
      if (target === document.body) return;
      handOffFocus(...tabbablesIn(dialog), dialogRef);
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, [dialogRef]);
}
