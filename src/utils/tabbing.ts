// src/utils/tabbing.ts
// "Which elements in here can Tab actually reach, in order?"
//
// The only place `tabbable` is imported, so the library — or the environment
// decision below — can be swapped in one file.
//
// This replaces a hand-written CSS selector that had been rewritten four times,
// each fix introducing the next defect. The selector could express `[disabled]`
// and `tabindex="-1"` and nothing else, so it could not see a control inside a
// `<fieldset disabled>` — which carries no `disabled` attribute of its own, and
// is exactly how slice B½ would group fields in the log sheet. Every child of a
// disabled group would have sat in the list looking tabbable, which makes every
// index-based question about that list wrong: that is the shape that produced
// two separate ways for focus to leave the page.
import { tabbable } from "tabbable";

/**
 * Has this environment ever reported layout?
 *
 * `tabbable` decides visibility with `Element.getClientRects()`, and **jsdom
 * does not implement layout** — every element measures as zero-area, so under
 * the library's default `displayCheck: "full"` an entire dialog reads as
 * hidden and the trap believes there is nothing to trap. tabbable's own README
 * calls `displayCheck: "none"` essential under jsdom for this reason.
 *
 * Setting `"none"` everywhere would be worse than the problem: the display
 * checking is most of why the dependency is here at all.
 *
 * So ask the environment the real question — *can you measure anything?* — and
 * not a proxy for it. `import.meta.env.MODE === "test"` is the usual answer and
 * is precisely the shape CLAUDE.md warns about: it stands in for the capability
 * we actually depend on, and would be wrong the moment tests run somewhere with
 * layout, or the app runs somewhere without it.
 *
 * Memoised only once it comes back TRUE. A `false` is never cached, so an early
 * call (before the document has been laid out) cannot pin the answer to the
 * wrong value for the rest of the session; in jsdom it re-probes, which costs
 * one call per Tab press and no reflow, since there is no layout to force.
 */
let layoutObserved = false;
function environmentReportsLayout(): boolean {
  if (layoutObserved) return true;
  layoutObserved = document.documentElement.getClientRects().length > 0;
  return layoutObserved;
}

/**
 * Everything inside `root` that Tab can reach, in tab order.
 *
 * Ordered, not just filtered: `tabbable` sorts by tabindex, so a positive
 * `tabIndex` no longer breaks the assumption the old selector rested on
 * ("nothing in this app uses one", which was true and load-bearing).
 *
 * **What is guaranteed everywhere**, because tabbable evaluates these
 * independently of `displayCheck`: `[disabled]`, negative tabindex, controls
 * inside a `<fieldset disabled>`, content in a closed `<details>`, unchecked
 * radios in a group, and `inert` subtrees. The B½ blocker is in that list, so
 * it is covered by unit tests rather than by a browser pass.
 *
 * **What is browser-only**: `display: none`, `visibility: hidden` and zero-area
 * elements. In jsdom those come back as tabbable. That is the same standing
 * limitation already recorded for `inert` and CSS in `src/test/focus.ts` — and
 * it is survivable rather than dangerous, because nothing here *acts* on the
 * list without `handOffFocus` verifying the move actually landed.
 *
 * SVG is filtered out. `tabbable` returns `HTMLElement | SVGElement`, while
 * `handOffFocus` resolves anything that is not an `HTMLElement` by reading
 * `.current` off it — so an `<svg tabindex="0">` would resolve to `undefined`
 * and throw on `.isConnected`. No dialog in this app contains a focusable SVG;
 * if one ever does, widen `FocusTarget` in `focus.ts` rather than special-casing
 * it here.
 */
export function tabbablesIn(root: Element): HTMLElement[] {
  return tabbable(root, {
    displayCheck: environmentReportsLayout() ? "full" : "none",
  })
    .filter((el): el is HTMLElement => el instanceof HTMLElement)
    .sort(byTabOrder);
}

/**
 * Tab order: positive `tabindex` first in ascending order, then everything else
 * in document order.
 *
 * The sort exists because **the order `tabbable` returns is not document order
 * under jsdom**, and the trap's entire job is rotating through that order.
 * Every clause of tabbable's selector carries a complex `:not([inert] *)`, and
 * jsdom's selector engine cannot match a list like that in one pass — it
 * evaluates clause by clause and concatenates, so results come back grouped by
 * *selector*, in tabbable's own clause order (input, select, textarea, a,
 * button, …), rather than by position in the document. Measured, not assumed: a
 * plain `input,a[href],button` list returns "abc" while the same list with the
 * `:not()` returns "bca". Browsers return document order for both.
 *
 * So the position is asked of the DOM directly rather than inherited from the
 * order a query happened to return — a no-op in a browser, and the repair that
 * makes jsdom agree with it. Without this the unit tests would exercise a
 * rotation order that production never sees, which is the exact class of
 * false-green this codebase keeps paying for.
 */
function byTabOrder(a: HTMLElement, b: HTMLElement): number {
  // Only a POSITIVE tabindex reorders anything; 0 and "absent" tab in document
  // order together, which is what `el.tabIndex > 0 ? … : 0` collapses them to.
  const ta = a.tabIndex > 0 ? a.tabIndex : 0;
  const tb = b.tabIndex > 0 ? b.tabIndex : 0;
  if (ta !== tb) {
    if (ta === 0) return 1;
    if (tb === 0) return -1;
    return ta - tb;
  }
  const position = a.compareDocumentPosition(b);
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
  if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
  return 0;
}
