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
  const path = `${process.cwd()}/src/styles.css`;
  try {
    return readFileSync(path, "utf8");
  } catch {
    // Resolved from the working directory, so running Vitest from a subdirectory
    // fails here at module load with a bare ENOENT and no clue why. Say what is
    // actually wrong instead.
    throw new Error(
      `focusRing.ts could not read ${path}. Run the suite from the project ` +
        `root (npm test -- --run); it resolves the stylesheet from the working ` +
        `directory because Vitest stubs CSS imports to an empty string.`
    );
  }
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
    // Does any declaration here actually paint something?
    //
    // Stated positively, because the negative form ("does it ONLY remove the
    // ring?") had a hole of exactly the kind this guard exists to close: a rule
    // setting only `outline-offset: -2px` — which the tab bar now uses, so its
    // ring draws inside the viewport — is not a removal, so it counted as
    // GRANTING a ring. `.tabbar` appeared twice in the allowlist, and dropping
    // the real rule during the UI redesign would have left the offset-only one
    // keeping it there, green and painting nothing.
    const ZEROED = ["none", "0", "0px", "0em", "0rem", "transparent"];
    const grantsRing = declarations.some((d) => {
      const [rawProp, ...rest] = d.split(":");
      const prop = rawProp.trim().toLowerCase();
      const value = rest
        .join(":")
        .replace(/!important/gi, "")
        .trim()
        .toLowerCase();
      // `outline-offset` alone paints nothing — it only shifts an outline that
      // has to come from somewhere else.
      if (prop === "outline-offset") return false;
      // An outline property zeroed out is the absence of a ring, not one.
      if (prop.startsWith("outline") && ZEROED.includes(value)) return false;
      return true;
    });
    if (!grantsRing) continue;

    for (const part of selector.split(",")) {
      const trimmed = part.trim();
      if (trimmed.includes(":focus")) selectors.push(trimmed);
    }
  }
  return selectors;
}

/**
 * Selectors that styles.css grants a visible focus indicator.
 *
 * Parsed rather than restated, so this cannot drift from the stylesheet the way
 * the stylesheet drifted from the components. Read once, at module load.
 */
const ringSelectors: string[] = parseRingSelectors(readStylesheet());

/**
 * Every selector with its `:focus` / `:focus-visible` pseudo stripped, so jsdom's
 * `matches()` can test the element itself — jsdom models neither pseudo.
 *
 * The cost, stated so it isn't mistaken for coverage: this cannot tell the two
 * apart. A target whose ONLY rule is `:focus-visible`, focused by a mouse-driven
 * action, passes here and paints nothing in Chrome — the split that
 * `styles.css` deliberately makes (`:focus` for focus applied as a dialog changes
 * state, `:focus-visible` for focus following a keyboard action) is invisible
 * from here. That half stays a browser check.
 */
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
