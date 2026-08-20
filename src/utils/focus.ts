// src/utils/focus.ts
// The one place focus is handed from a disappearing element to a surviving one.
//
// WAI-ARIA's dialog pattern says focus must land somewhere logical whenever the
// element holding it goes away. Doing that by hand at each site produced NINE
// defects in slice B, several of them introduced by the previous round's fix,
// because every site re-derived the same three rules and each got a different
// subset right:
//
//   1. `<body>` is never an answer. It is the browser's response to "nowhere",
//      and it is *connected*, so an `isConnected` check waves it through. This
//      is the common case, not an edge one: Safari does not focus a <button>
//      when you tap it, so on the app's primary platform the "opener" captured
//      when a sheet opens is routinely <body>.
//   2. `focus()` fails silently. On an element that is disconnected, hidden,
//      disabled, or simply has no tabindex, it does nothing at all and leaves
//      focus exactly where it was — which is usually <body>. The only way to
//      know it worked is to look afterwards.
//   3. There is always more than one candidate. The row, then its neighbour,
//      then the count line; the opener, then the view title. Each site had its
//      own hand-rolled chain, so a fix to one taught the others nothing.
//
// Every caller now expresses only what is specific to it — the candidates, in
// priority order — and inherits all three rules.
import type { RefObject } from "react";

/**
 * Somewhere focus could go: an element, a ref to one, or nothing. Refs are
 * accepted directly because every caller already holds one, and unwrapping at
 * the call site is exactly the boilerplate that let sites drift apart.
 */
export type FocusTarget =
  | FocusableElement
  | RefObject<HTMLElement | null>
  | null
  | undefined;

/**
 * Anything the browser will actually focus.
 *
 * `SVGElement` is included because a focusable `<svg tabindex="0">` IS in the
 * browser's tab order, and both implement `HTMLOrSVGElement`. Excluding it from
 * a tab-order list would make the list disagree with the browser and quietly
 * answer index questions about the wrong neighbour. The roadmap commits to
 * hand-rolled inline SVG icons, so this stops being hypothetical.
 */
export type FocusableElement = HTMLElement | SVGElement;

const resolve = (target: FocusTarget): FocusableElement | null => {
  if (!target) return null;
  // `instanceof`, not `"current" in target`. A real element can have a `current`
  // property: HTMLFormElement exposes its named controls as own properties, so a
  // form containing <input name="current"> would resolve to the input instead of
  // the form. Both Modal call sites splat raw querySelectorAll results in here,
  // and FOCUSABLE's `[tabindex]` clause matches <form tabindex="0">.
  // `instanceof Element`, which covers SVG too — not `instanceof HTMLElement`,
  // which sent an SVGElement down the ref branch to `.current` (undefined) and
  // then threw on `.isConnected`.
  return target instanceof Element ? target : target.current;
};

/**
 * Can this element actually take focus right now?
 *
 * Deliberately not a check for *why* it might not — tabindex, disabled, hidden,
 * `inert`, a display:none ancestor and a dozen other reasons all end the same
 * way, and enumerating them is how you miss one. {@link handOffFocus} answers
 * the question by trying and then looking, which cannot be wrong.
 */
const isPlausible = (el: FocusableElement | null): el is FocusableElement =>
  // <body> is excluded before anything else: it is where focus goes when it goes
  // nowhere, so accepting it means declaring success on the exact failure this
  // module exists to prevent.
  el !== null && el !== document.body && el.isConnected;

/**
 * Move focus to the first candidate that will take it.
 *
 * Tries each in order, skipping the ones that can't hold focus, and **verifies**
 * the browser agreed before moving on. Returns the element that ended up with
 * focus, or `null` if none would take it — a `null` return means focus is still
 * wherever it was, which callers can treat as a bug rather than a shrug.
 *
 * Order the arguments most-specific first: the element the user was working
 * with, then its neighbour, then the region that contains it. The last argument
 * should be something that always exists and is always focusable (a `tabIndex={-1}`
 * heading or landmark), so the chain has a floor.
 *
 * @example
 * // The row that replaced the deleted one, else the row above, else the count.
 * handOffFocus(rows[at], rows[at - 1], countRef);
 */
export function handOffFocus(
  ...candidates: FocusTarget[]
): FocusableElement | null {
  for (const candidate of candidates) {
    const el = resolve(candidate);
    if (!isPlausible(el)) continue;

    el.focus();

    // The verification that makes this worth centralising. `focus()` has no
    // return value and throws nothing, so a target that silently refused is
    // indistinguishable from one that accepted — unless you look. Sites that
    // didn't look are how focus reached <body> from three different controls.
    if (document.activeElement === el) return el;
  }
  return null;
}
