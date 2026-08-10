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
/**
 * Selectors granted a focus indicator by `css`.
 *
 * Exported so it can be tested against synthetic stylesheets: the live one has
 * no ring-REMOVING `:focus` rule today, so a test driven by the real file cannot
 * tell whether that exclusion works — and an exclusion nobody can see fail is
 * how the previous, broken one survived.
 */
/**
 * The real stylesheet, read from disk.
 *
 * Not imported: Vitest stubs CSS imports to an empty string by default, so
 * `import css from "../styles.css?raw"` silently yields nothing — and a parser
 * that finds nothing makes every ring assertion pass vacuously. (The test
 * asserting this parser found real selectors exists because that is exactly what
 * happened, twice, while building it.)
 *
 * Path from the project root, not `import.meta.url`: Vitest serves modules over
 * a dev-server URL, so resolving relative to this file yields "/src/styles.css"
 * — absolute from the filesystem root, and nonexistent.
 */
function readStylesheet(): string {
  return readFileSync(`${process.cwd()}/src/styles.css`, "utf8");
}

export function parseRingSelectors(css: string): string[] {
  // Comments are stripped FIRST. Without that, `[^{}]+` swallows the comment
  // block above a rule into its selector, so the first selector in every list is
  // unparseable and never matches — and these comments discuss `:focus-visible`
  // in prose, which the block filter would then believe.
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const selectors: string[] = [];

  // Rule blocks whose selector mentions :focus and whose body does anything
  // other than REMOVE the ring.
  //
  // Deliberately not a list of properties that "count" as an indicator. The
  // first version allowed only outline / box-shadow / border-color, which
  // misfiled `.skip-link:focus` — it reveals a visually-hidden link by setting
  // `left` and `top`, a perfectly good focus treatment — and would misfile a
  // redesign that reached for `background` or `transform`. Deciding whether an
  // indicator is *good enough* is a human and browser judgement; the question
  // this guard can actually answer is whether a focus rule exists at all.
  //
  // The exclusion is a real parse, not a negative lookahead. The previous
  // `/outline\s*:\s*(?!none)/` never excluded anything: `\s*` backtracks, gives
  // the space back, and the lookahead then runs against " none" and succeeds —
  // so a rule that only removed a ring was recorded as granting one, and every
  // element it matched would have passed vacuously.
  for (const [, selector, body] of source.matchAll(/([^{}]+)\{([^{}]+)\}/g)) {
    if (!selector.includes(":focus")) continue;
    const declarations = body
      .split(";")
      .map((d) => d.trim())
      .filter(Boolean);
    // A rule only REMOVES the ring when every declaration in it is an
    // outline-family property being zeroed. Matching just the literal `outline:
    // none` and `outline: 0` let `outline: 0px`, `outline: none !important`, and
    // `outline: none; outline-offset: 0` through as rings — the same vacuous-pass
    // class as the backtracking lookahead this replaced.
    const onlyRemovesTheRing =
      declarations.length > 0 &&
      declarations.every((d) => {
        const [prop, ...rest] = d.split(":");
        if (!prop.trim().startsWith("outline")) return false;
        const value = rest
          .join(":")
          .replace(/!important/gi, "")
          .trim()
          .toLowerCase();
        return ["none", "0", "0px", "0em", "0rem", "transparent"].includes(value);
      });
    if (declarations.length === 0 || onlyRemovesTheRing) continue;

    for (const part of selector.split(",")) {
      const trimmed = part.trim();
      if (trimmed.includes(":focus")) selectors.push(trimmed);
    }
  }
  return selectors;
}

const ringSelectors: string[] = parseRingSelectors(readStylesheet());

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
