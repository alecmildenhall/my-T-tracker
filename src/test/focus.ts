// src/test/focus.ts
// The shared assertion the roadmap asked for: focus is never left on <body>.
//
// Nine focus defects shipped in slice B and four of them were this exact
// condition, each found by hand, one control at a time, after review. A rule
// that holds across every flow should be checked across every flow — so it is
// written once here and applied to whole interactions rather than restated per
// case.
//
// What this deliberately does NOT cover: jsdom implements neither `inert` nor
// CSS, so "the trap is escapable by clicking the dialog's padding" and "the
// hand-off is invisible because no rule styles programmatic focus" — two more of
// the nine — cannot be seen from here at all. Those stay browser checks. The
// note is in this file so nobody reads a green suite as covering them.
import { waitFor } from "@testing-library/react";
import { expect } from "vitest";
import { expectVisibleFocusRing } from "./focusRing";

const isNowhere = (el: Element | null): boolean =>
  el === null || el === document.body;

/**
 * Assert focus is somewhere a person can use.
 *
 * `<body>` is the browser's way of saying "nowhere": the next Tab restarts at
 * the top of the document and a screen reader announces nothing. It is also
 * what `focus()` leaves behind when it silently fails, so this catches both a
 * missing hand-off and one that was attempted and refused.
 *
 * Use this after an interaction that MUST place focus deliberately — closing a
 * dialog, deleting the row you were on. For an ordinary interaction, prefer
 * {@link withFocusGuard}, which won't report focus that was already nowhere.
 *
 * @param context what just happened, e.g. "after deleting the last row"
 */
function expectFocusLanded(context: string): void {
  expect(
    isNowhere(document.activeElement),
    `Focus was left on <body> ${context}. The element that had focus went away ` +
      `without handing focus on — use handOffFocus() from src/utils/focus.ts.`
  ).toBe(false);
}

export function expectFocusSomewhereUseful(context: string): void {
  expectFocusLanded(context);
  // ...and that you can SEE where it went. These were two halves of one defect
  // in slice B — focus moving correctly with nothing on screen changing — but
  // only the first half was checked across every flow, while the ring guard was
  // wired at a single call site and had to be remembered per test. It was
  // forgotten for the new teaser delete, whose `.recent-shots` target had no
  // rule. Asking both questions here means a new hand-off target cannot be
  // added without a rule, at every site that already guards focus.
  expectVisibleFocusRing(context);
}

/**
 * Run an interaction and assert it did not STRAND focus.
 *
 * Takes the interaction rather than being called after it, so the check cannot
 * be forgotten at the one call site that needed it — which is how the previous
 * round of hand-rolled checks let four defects through.
 *
 * If focus was already nowhere before the interaction, this passes: the
 * interaction cannot have dropped what nothing was holding. That is not a
 * loophole, it is the difference between the bug (focus was somewhere, the
 * element vanished, nothing caught it) and an artifact of the environment —
 * jsdom's `fireEvent.click` does not focus the clicked element, and neither does
 * Safari, so a test that clicked its way here often starts from <body>. Real
 * clicks in a real browser do focus, which is why the Playwright pass covers the
 * cases this one is quiet about.
 */
export function withFocusGuard(context: string, interaction: () => void): void {
  const held = !isNowhere(document.activeElement);
  interaction();
  if (held) expectFocusSomewhereUseful(context);
}

/**
 * Wait for focus to settle somewhere usable, then assert it did.
 *
 * **Use this after anything that unmounts a dialog.** Focus restoration is
 * asynchronous relative to the DOM: `Modal` restores focus from a passive effect
 * cleanup, which runs *after* React has removed the dialog — so there is a real
 * window where the element that held focus is gone and nothing has claimed it
 * yet. `waitFor(dialog gone)` can land inside that window, and asserting there
 * fails on a condition that resolves microseconds later.
 *
 * That intermittency is what it looks like: a suite that goes red roughly one
 * run in fifteen, on a different test each time. The synchronous
 * {@link expectFocusSomewhereUseful} is still right after an interaction that
 * moves focus without unmounting anything.
 */
export async function expectFocusSettled(context: string): Promise<void> {
  // Only the LANDING is retried. The ring question is answered by the
  // stylesheet, so it has the same answer on every attempt — putting it inside
  // `waitFor` turned a deterministic "this class has no rule" into a ~1s hang
  // before the message appeared, and left it able to pass if focus happened to
  // move on to a ringed element while the retries ran. Asked once, after the
  // thing that is genuinely asynchronous has settled.
  await waitFor(() => expectFocusLanded(context));
  expectVisibleFocusRing(context);
}
