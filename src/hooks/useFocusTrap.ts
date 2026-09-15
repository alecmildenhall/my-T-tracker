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
import { useEffect, useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";
import {
  isRegisteredDialog,
  isTopmostDialog,
  registerDialog,
} from "../utils/dialogStack";
import { handOffFocus } from "../utils/focus";
import type { FocusableElement } from "../utils/focus";
import { tabbablesIn } from "../utils/tabbing";

/**
 * A radio whose group has no checked member.
 *
 * Scoped to the owning form when there is one, because that is how radio groups
 * are scoped — two forms may legitimately use the same `name` for different
 * groups, and a document-wide lookup would let one form's answer silence the
 * other's.
 */
function isRadioInUncheckedGroup(el: Element | null): boolean {
  if (!(el instanceof HTMLInputElement) || el.type !== "radio") return false;
  // An unnamed radio is not in a group at all — and `[name=""]` matches nothing,
  // so without this it would look unchecked forever and be handed to the browser
  // on every Tab.
  if (el.name === "") return false;
  const scope: ParentNode = el.form ?? el.ownerDocument;
  return !scope.querySelector(
    `input[type="radio"][name="${CSS.escape(el.name)}"]:checked`,
  );
}

/** Inputs whose own Tab handling moves between segments inside the control. */
const SEGMENTED_INPUT =
  'input[type="date"], input[type="time"], input[type="datetime-local"], ' +
  'input[type="month"], input[type="week"]';

/** The registry moved to `src/utils/dialogStack.ts` when `Modal`'s modality
 *  started needing the same question — see that file for why it is one owner
 *  and not a refcount. Aliased so the guards below read as they always did. */
const isTopmost = isTopmostDialog;

interface Options {
  /** Escape, and the Back gesture's equivalent, ask the parent to close. */
  onEscape: () => void;
}

export function useFocusTrap(
  dialogRef: RefObject<HTMLElement | null>,
  { onEscape }: Options,
): void {
  // Hold the latest callback so the listeners subscribe once per mount rather
  // than re-adding whenever the caller passes a fresh inline closure.
  const onEscapeRef = useRef(onEscape);
  useEffect(() => {
    onEscapeRef.current = onEscape;
  });

  // A LAYOUT effect, and that is the whole point — registration has to happen
  // before anything moves focus.
  //
  // As an ordinary effect this was a real bug: Modal focuses its content from a
  // passive effect declared ABOVE this hook, so a dialog opened from inside
  // another one focused its first control while still unregistered. The older
  // dialog was therefore still "topmost", saw focus land somewhere it did not
  // contain, and hauled it straight back — so opening a confirm from a sheet
  // left focus on the button that opened it.
  //
  // Layout effects run during the commit, before every passive effect in the
  // tree, so a mounting dialog is always registered before any focus effect
  // runs — including its own. That makes the ordering a property of the phase
  // rather than of where this hook happens to be called in Modal.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    return registerDialog(dialog);
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
      // being typed into. Registered-but-not-topmost only: an UNREGISTERED
      // dialog still gets Escape.
      //
      // The membership guard inside `isTopmost` fails closed, which is right
      // for trapping — a dialog that does not trap is recoverable, two dialogs
      // fighting over focus is not. Applying it to Escape as well was not: the
      // registration effect's deps never change, so a caller whose ref is empty
      // on the first commit gets no Tab containment AND no Escape, forever. For
      // `variant="sheet"` backdrop-click is disabled too, which would leave no
      // keyboard dismissal at all (WCAG 2.1.2). Unreachable through `Modal`,
      // whose element always renders, but this is a shared hook.
      if (isRegisteredDialog(dialog) && !isTopmost(dialog)) return;

      // Ctrl/Alt/Cmd combinations belong to the browser and the OS, and this
      // guard covers the WHOLE handler — it used to sit below the Escape branch
      // and so protected only Tab. Alt+Esc cycles windows on Windows and
      // Cmd-modified Escapes are OS-level on macOS, and each of them dispatches
      // an Escape keydown to the page: measured, all of Alt/Control/Meta+Escape
      // dismissed the log sheet. Coming back from another app to find your
      // half-filled form gone is not a dismissal anyone asked for.
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      if (e.key === "Escape") {
        onEscapeRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      // Trapping, unlike Escape, stays strictly fail-closed: an unregistered
      // dialog must not own Tab, or two of them fight over focus.
      if (!isTopmost(dialog)) return;
      // Already handled. The old trap only acted at the list edges, so a second
      // delivery of the same Tab was a no-op; this one rotates ONE STEP from
      // wherever focus is, so a duplicate delivery advances twice and lands a
      // control further on than the user asked for.
      if (e.defaultPrevented) return;

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
      const active = document.activeElement as FocusableElement | null;
      // `let`, because the unchecked-radio branch below re-points it at the
      // group's edge when it cannot stand aside — see there.
      let at = active ? list.indexOf(active) : -1;

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

      // A radio group with NOTHING checked is the same shape of problem, and
      // needs the same answer.
      //
      // The browser treats such a group as ONE tab stop: Tab enters the first
      // member and the next Tab leaves the group entirely, because arrow keys —
      // not Tab — are how you move within it. `tabbable` disagrees: with no
      // member checked it reports every radio as tabbable, which is right about
      // focusability and wrong about the tab ORDER. Since this trap owns Tab and
      // rotates through that list, the library's answer became the behaviour,
      // and the log sheet's four pain chips were four tab stops instead of one —
      // in the state every new shot starts in.
      //
      // Measured in the running app: with nothing selected, Tab visited none,
      // mild, moderate, severe; with one selected, just the checked chip. So the
      // defect only exists in the default state, which is also the state most
      // shots are logged in.
      //
      // Handing Tab back lets the browser do the native thing. `beyond` is
      // computed past the whole GROUP rather than past this radio: the other
      // members are in `list`, so measuring from the current index would count
      // them as somewhere to go and hand the browser a Tab that walks off the
      // end of an inert page.
      if (at !== -1 && isRadioInUncheckedGroup(active)) {
        // Scoped to the same form AND the same non-empty name, matching
        // `isRadioInUncheckedGroup` above. Matching on name alone was a
        // narrower claim than that function makes: two forms in one dialog
        // sharing a name would have had the span cross between them, and a
        // radio with NO name would lump every unnamed radio in the dialog into
        // one "group". Neither is reachable through today's single-form sheet;
        // both are the kind of thing B½ adds fields to this sheet to find.
        const activeRadio = active as HTMLInputElement;
        const sameGroup = (el: FocusableElement) =>
          el instanceof HTMLInputElement &&
          el.type === "radio" &&
          el.name !== "" &&
          el.name === activeRadio.name &&
          el.form === activeRadio.form;
        // The group's TRUE span — first and last member anywhere in the list,
        // not a contiguous run out from the first. Radios are grouped by `name`,
        // and nothing requires members to be adjacent in the tab order: one
        // unrelated control between two chips made the old scan stop early, so
        // `beyond` was computed against a short span and, at an end of the
        // order, `at` could rotate BACKWARDS on a forward Tab. Unreachable while
        // the four chips sit together — and "the fields happen to be in this
        // order" is exactly the assumption the segmented-input hatch above
        // already records as fragile, in the sheet B½ keeps adding fields to.
        const first = list.findIndex(sameGroup);
        let last = first;
        for (let i = list.length - 1; i > last; i--) {
          if (sameGroup(list[i])) {
            last = i;
            break;
          }
        }
        const beyond = e.shiftKey ? first > 0 : last < list.length - 1;
        if (beyond) return;
        // Nowhere safe to stand aside — the group sits at an END of the order,
        // so handing Tab over would walk off an inert page. We keep it, and
        // rotate from the group's EDGE rather than from this radio.
        //
        // Without that the fallthrough stepped to `list[at + 1]`, which is the
        // NEXT RADIO IN THE SAME GROUP — quietly reinstating the multiple tab
        // stops this branch exists to remove, in exactly the position where
        // nothing else can help. Not reachable in today's log sheet, where the
        // off-days group, notes and Save follow the pain chips; B½ adds
        // fields to this sheet, which is the same ordering assumption the
        // segmented-input hatch above already records as fragile.
        at = e.shiftKey ? first : last;
      }

      // The mirror of that, and the half it was missing: stepping BACKWARDS
      // *into* a segmented input has to be the browser's move as well.
      //
      // `handOffFocus` moves focus with `el.focus()`, which enters a date or
      // time field at its FIRST segment — correct going forwards, and exactly
      // wrong going backwards, where the browser enters at the LAST. Landing on
      // the hour meant the next Shift+Tab left the field immediately, so
      // minutes and AM/PM could not be reached backwards at all. Measured on
      // the log sheet: one backward stop inside the dialog against four for the
      // same control outside one.
      //
      // Safe to hand over precisely when there is a control before this one
      // (`at > 0`), because the browser's backward move then lands inside that
      // control and cannot leave the dialog. At the boundary we still own it
      // and still enter at the first segment — the residual the roadmap
      // records, now genuinely limited to an END of the tab order rather than
      // to every segmented field with a non-segmented neighbour.
      let order: FocusableElement[];
      /**
       * What the BROWSER would move to if we stood aside on Shift+Tab: the last
       * tabbable before `active` in document order, or null when there is none
       * — in which case standing aside would walk off an inert page.
       *
       * Computed in every branch rather than from `at`, because the first
       * version of this fix asked only `at > 0` and so covered the branch where
       * focus sits on a LISTED control. Focus on a `tabIndex={-1}` element is
       * the other branch, and the comment there calls it "not a rare case: it
       * is where every hand-off inside a dialog lands" — so the defect this was
       * written to fix was still reachable through the door beside it. Read
       * before `before.reverse()`, which mutates in place.
       */
      let backwardNeighbour: FocusableElement | null = null;
      if (at !== -1) {
        // On one of the controls: rotate from it, and end back on it so that a
        // dialog with a single focusable does nothing rather than escaping.
        const after = list.slice(at + 1);
        const before = list.slice(0, at);
        backwardNeighbour = before.length ? before[before.length - 1] : null;
        order = e.shiftKey
          ? [...before.reverse(), ...after.reverse(), list[at]]
          : [...after, ...before, list[at]];
      } else if (
        active &&
        dialog.contains(active) &&
        // `compareDocumentPosition` below splits the list by DOCUMENT order,
        // while `tabbablesIn` returns TAB order — the two agree only while
        // nothing carries a positive tabindex. The old selector was explicitly
        // guarded by "nothing in this app uses one"; this hook's list producer
        // dropped that constraint and this consumer quietly kept depending on
        // it, so the halves disagreed about what the array meant.
        //
        // Rather than build an ordering this branch cannot express, detect the
        // disagreement and fall through to entering from an end — which is
        // always inside the dialog, just less precise. Nothing in the app sets
        // a positive tabindex, so this costs nothing today and stops being
        // wrong if anything ever does.
        !list.some((el) => el.tabIndex > 0)
      ) {
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
            Node.DOCUMENT_POSITION_FOLLOWING,
        );
        const after = nextIdx === -1 ? [] : list.slice(nextIdx);
        // `list.slice()`, not `list`. `.reverse()` mutates in place, so
        // aliasing `list` here reverses the array every other branch reads.
        const before = nextIdx === -1 ? list.slice() : list.slice(0, nextIdx);
        backwardNeighbour = before.length ? before[before.length - 1] : null;
        order = e.shiftKey
          ? [...before.reverse(), ...after.reverse()]
          : [...after, ...before];
      } else {
        // Genuinely outside: enter from the appropriate end.
        order = e.shiftKey ? [...list].reverse() : list;
      }

      // Stepping BACKWARDS into a segmented input has to be the browser's move.
      // `handOffFocus` uses `el.focus()`, which enters a date or time field at
      // its FIRST segment — right going forwards, exactly wrong going
      // backwards, where the browser enters at the LAST. Landing on the hour
      // meant the next Shift+Tab left the field, so minutes and AM/PM could not
      // be reached backwards at all. Measured on the log sheet: one backward
      // stop inside the dialog against four for the same control outside one.
      //
      // Safe precisely when a control precedes it, because the browser's own
      // backward move then lands inside that control and cannot leave the
      // dialog. At the boundary we keep it and still enter at the first
      // segment — the residual the roadmap records, genuinely limited to an END
      // of the tab order rather than to every segmented field with a
      // non-segmented neighbour.
      if (e.shiftKey && backwardNeighbour?.matches(SEGMENTED_INPUT)) return;

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
      // Belt and braces: `handOffFocus` refuses disconnected candidates anyway,
      // so removing this changes no observable behaviour. It is here to avoid
      // the pointless `tabbablesIn` walk over a dead subtree on every focus
      // move during teardown.
      if (!dialog?.isConnected) return;
      // This one, by contrast, is load-bearing, and not only for correctness.
      // Modal portals every dialog to <body>, so two open dialogs are SIBLINGS:
      // each one sees focus in the other as "outside me" and pulls it back, and
      // the two nets then fight for focus forever. Measured, not theorised —
      // deleting this line hung the test run until it was killed at ten
      // minutes, rather than failing.
      if (!isTopmost(dialog)) return;
      const target = e.target;
      if (!(target instanceof Node) || dialog.contains(target)) return;
      // `<body>` used to be excluded here, on the reasoning that recovering it
      // would fight Modal's close-time restore. That reasoning was wrong: the
      // restore runs from a PASSIVE cleanup, by which point React has nulled
      // the host ref and the layout cleanup has already deregistered, so both
      // guards above have returned long before. Verified by removing the line
      // and watching the sheet still restore to "+ Log a shot" and a confirm to
      // its row's Delete button.
      //
      // Recovering it is also the rule this codebase treats as non-negotiable:
      // `<body>` is the browser's way of saying "nowhere". Worth knowing that
      // the case is hard to reach in Chrome — clicking the sheet's dead padding
      // lands on the `.dialog` container, because it carries `tabIndex={-1}`
      // and Chrome focuses the nearest focusable ancestor, so focus never
      // reaches `<body>` at all. Measured, with and without this line. It stays
      // out for the browsers that do not do that, since the whole point of a
      // net is the cases nobody enumerated.
      handOffFocus(...tabbablesIn(dialog), dialogRef);
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, [dialogRef]);
}
