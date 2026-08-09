// src/test/focusRing.ts
// Does the element that just received focus actually get a ring?
//
// `handOffFocus` made *where focus goes* one owner. Whether you can SEE it
// landed stayed a hand-maintained list of class names in styles.css, with
// nothing keeping the two in sync — so a new hand-off target, or a class renamed
// during the UI redesign, moves focus correctly and invisibly. That is one of
// slice B's nine defects ("the hand-offs were invisible: focus moved with
// nothing on screen changing", WCAG 2.4.7), and its only guard was a person
// remembering.
//
// This closes the loop in jsdom by reading the real stylesheet: after a hand-off,
// the focused element must match some selector the stylesheet actually gives a
// ring to. It catches a target with no rule, a renamed class, and a deleted rule.
//
// What it CANNOT do, and why the browser pass stays: jsdom does not compute
// styles from a stylesheet it never loaded, and `:focus-visible` matching depends
// on input modality the DOM doesn't model. So this proves a rule EXISTS for the
// element; only a real browser proves it PAINTS. Both halves are needed — the
// modality nuance is exactly why styles.css uses `:focus` for dialog-open targets
// and `:focus-visible` for post-action ones.
import { readFileSync } from "node:fs";
import { expect } from "vitest";

/**
 * Selectors that styles.css grants a visible focus indicator.
 *
 * Parsed rather than restated, so this cannot drift from the stylesheet the way
 * the stylesheet drifted from the components. Read once at module load.
 */
const ringSelectors: string[] = (() => {
  // Read from disk rather than imported: Vitest stubs CSS imports to an empty
  // string by default, so `import css from "../styles.css?raw"` silently yields
  // nothing — and a parser that finds nothing makes every ring assertion pass
  // vacuously. (The test asserting this parser found real selectors exists
  // because that is exactly what happened while building it.)
  //
  // Comments are stripped FIRST. Without that, `[^{}]+` swallows the comment
  // block above a rule into its selector, so the first selector in every list is
  // unparseable and never matches — and these comments discuss `:focus-visible`
  // in prose, which the block filter would then believe.
  // Path from the project root, not `import.meta.url`: Vitest serves modules over
  // a dev-server URL, so resolving relative to this file yields "/src/styles.css"
  // — absolute from the filesystem root, and nonexistent.
  const css = readFileSync(`${process.cwd()}/src/styles.css`, "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    ""
  );
  const selectors: string[] = [];

  // Rule blocks whose selector mentions :focus and whose body paints something
  // you can see. `outline: none` is excluded deliberately — the field reset at
  // the top of styles.css uses it, and it is the absence of a ring, not one.
  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]+)\}/g)) {
    if (!selector.includes(":focus")) continue;
    const paints =
      /outline\s*:\s*(?!none)[^;]+/.test(body) ||
      /box-shadow\s*:\s*(?!none)[^;]+/.test(body) ||
      /border-color\s*:\s*[^;]+/.test(body);
    if (!paints) continue;

    for (const part of selector.split(",")) {
      const trimmed = part.trim();
      if (trimmed.includes(":focus")) selectors.push(trimmed);
    }
  }
  return selectors;
})();

/** Every selector, with the :focus/:focus-visible pseudo stripped so jsdom's
 *  `matches()` can test the element itself — jsdom does not track focus-visible. */
const structuralSelectors = ringSelectors.map((s) =>
  s.replace(/:focus-visible|:focus/g, "").trim()
);

/**
 * Assert the currently focused element is one the stylesheet rings.
 *
 * @param context what just happened, e.g. "after deleting the last row"
 */
export function expectVisibleFocusRing(context: string): void {
  const el = document.activeElement as HTMLElement | null;
  if (!el || el === document.body) {
    // Not this assertion's job — expectFocusSomewhereUseful reports that, with a
    // better message. Staying quiet here keeps one failure from reading as two.
    return;
  }

  const ringed = structuralSelectors.some((selector) => {
    try {
      return el.matches(selector);
    } catch {
      return false; // a selector jsdom can't parse is not a match
    }
  });

  expect(
    ringed,
    `Focus landed on <${el.tagName.toLowerCase()} class="${el.className}"> ` +
      `${context}, and styles.css gives it no focus ring — so focus moves with ` +
      `nothing on screen changing (WCAG 2.4.7). Add it to the hand-off ring rule ` +
      `in styles.css. Note the :focus vs :focus-visible split there is deliberate: ` +
      `dialog-open targets need :focus because Chrome won't mark auto-focus as ` +
      `focus-visible; post-action targets need :focus-visible so a mouse user ` +
      `isn't left with an outline round a whole panel.`
  ).toBe(true);
}

/** Exposed for the test that proves this parser found anything at all. */
export const __ringSelectorsForTest = structuralSelectors;
