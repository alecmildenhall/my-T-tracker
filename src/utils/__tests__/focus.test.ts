import { readFileSync } from "node:fs";
import { describe, it, expect, afterEach } from "vitest";
import { handOffFocus } from "../focus";

const mounted = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  init?: (el: HTMLElementTagNameMap[K]) => void,
): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag);
  init?.(el);
  document.body.appendChild(el);
  return el;
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("handOffFocus", () => {
  it("focuses the first candidate that will take it", () => {
    const first = mounted("button");
    const second = mounted("button");

    expect(handOffFocus(first, second)).toBe(first);
    expect(document.activeElement).toBe(first);
  });

  it("falls through a candidate that silently refuses focus", () => {
    // The defect this module exists for: focus() has no return value and throws
    // nothing, so a target that refused is indistinguishable from one that
    // accepted — unless you look afterwards. A plain `?? ` chain does not look.
    const unfocusable = mounted("div"); // no tabindex — focus() is a no-op
    const real = mounted("button");

    expect(handOffFocus(unfocusable, real)).toBe(real);
    expect(document.activeElement).toBe(real);
  });

  it("skips a disabled control", () => {
    const disabled = mounted("button", (el) => (el.disabled = true));
    const real = mounted("button");

    expect(handOffFocus(disabled, real)).toBe(real);
  });

  it("skips an element that has been removed from the document", () => {
    // A confirm dialog routinely deletes the row that opened it.
    const gone = mounted("button");
    const fallback = mounted("button");
    gone.remove();

    expect(handOffFocus(gone, fallback)).toBe(fallback);
  });

  it("never accepts <body>, even though it is connected and 'focusable'", () => {
    // The subtle one. <body> is where focus goes when it goes NOWHERE, and it is
    // connected — so an isConnected check waves it through. It is also the
    // common case rather than an edge one: Safari does not focus a <button> when
    // you tap it, so the "opener" captured when a sheet opens is routinely
    // <body> on the app's primary platform.
    const real = mounted("button");

    expect(handOffFocus(document.body, real)).toBe(real);
    expect(document.activeElement).toBe(real);
  });

  it("skips null, undefined, and refs pointing at nothing", () => {
    const real = mounted("button");

    expect(handOffFocus(null, undefined, { current: null }, real)).toBe(real);
  });

  it("does not mistake an element with a `current` property for a ref", () => {
    // HTMLFormElement exposes its named controls as own properties, so a form
    // containing <input name="current"> satisfies `"current" in target` and a
    // duck-typed check would resolve to the INPUT instead of the form. Both
    // Modal call sites splat raw querySelectorAll results into handOffFocus, and
    // FOCUSABLE's `[tabindex]` clause matches <form tabindex="0">.
    // jsdom does not implement form named-property access, so the property is
    // defined by hand here: what is being pinned is the discriminator, not
    // jsdom's form behaviour. Confirmed in Chrome that a real form with an
    // <input name="current"> does expose it as `form.current`.
    const el = mounted("div", (d) => (d.tabIndex = -1));
    Object.defineProperty(el, "current", {
      value: document.createElement("input"),
    });

    expect("current" in el).toBe(true); // the duck-type check would be fooled
    expect(handOffFocus(el)).toBe(el);
    expect(document.activeElement).toBe(el);
  });

  it("accepts refs and elements interchangeably", () => {
    const el = mounted("button");

    expect(handOffFocus({ current: el })).toBe(el);
    expect(document.activeElement).toBe(el);
  });

  it("reports failure rather than pretending, when nothing will take focus", () => {
    // A null return is actionable — it means focus is still wherever it was, and
    // the caller has a bug in its candidate list. Silently returning is how a
    // hand-off looks fine and leaves focus on <body>.
    const unfocusable = mounted("div");

    expect(handOffFocus(unfocusable, null)).toBeNull();
  });

  it("takes no candidates at all without throwing", () => {
    expect(handOffFocus()).toBeNull();
  });

  it("leaves focus untouched when every candidate refuses", () => {
    const held = mounted("button");
    held.focus();

    expect(handOffFocus(mounted("div"))).toBeNull();
    expect(document.activeElement).toBe(held);
  });
});

describe("the ring guard itself", () => {
  it("parsed real selectors out of styles.css", async () => {
    // A parser that silently found nothing would make every ring assertion pass
    // vacuously — which is exactly how the last round of hand-rolled checks let
    // four defects through.
    const { __ringSelectorsForTest } = await import("../../test/focusRing");

    expect(__ringSelectorsForTest.length).toBeGreaterThan(10);
    expect(__ringSelectorsForTest).toContain(".shot-list-item");
    expect(__ringSelectorsForTest).toContain(".app-title");
    // Comments are stripped before parsing; without that the first selector of
    // every list arrives glued to the comment above it and never matches.
    expect(__ringSelectorsForTest.every((s) => !s.includes("/*"))).toBe(true);
    expect(__ringSelectorsForTest.every((s) => !s.includes("*/"))).toBe(true);
    // Every pseudo is stripped, including `:focus-within`. It was not: the
    // pattern matched `:focus` inside it and left `-within` behind, turning
    // `.pain-chip:focus-within` into `.pain-chip-within` — a selector that
    // matches nothing, so the chips' only focus indicator was invisible to this
    // guard and the test relying on it passed with the rule deleted.
    expect(__ringSelectorsForTest.every((s) => !s.includes("focus"))).toBe(
      true,
    );
    expect(__ringSelectorsForTest.every((s) => !s.includes("-within"))).toBe(
      true,
    );
    expect(__ringSelectorsForTest).toContain(".pain-chip");
  });

  it("counts a focus rule that reveals a hidden element, not just outlines", async () => {
    // `.skip-link:focus` has no outline, box-shadow or border — it makes a
    // visually-hidden link visible by setting left/top, which is a perfectly
    // good focus indicator. An allow-list of "ring" properties classified it as
    // unringed, which would fail any future hand-off styled that way with a
    // message telling the author to add a rule that already exists.
    const { __ringSelectorsForTest } = await import("../../test/focusRing");
    expect(__ringSelectorsForTest).toContain(".skip-link");
  });

  it("does not count a rule that only REMOVES the ring", async () => {
    // Driven by synthetic CSS, not the live stylesheet: nothing in styles.css
    // both mentions :focus and only strips the outline, so a test reading the
    // real file cannot tell whether this exclusion works — which is exactly how
    // the previous, broken version of it survived. That one used a negative
    // lookahead that never excluded anything (`\s*` backtracks, so the lookahead
    // ran against " none" and passed), meaning a ring-removing rule was recorded
    // as granting one and every element it matched passed vacuously.
    const { parseRingSelectors } = await import("../../test/focusRing");

    expect(parseRingSelectors(".a:focus { outline: none; }")).toEqual([]);
    expect(parseRingSelectors(".a:focus { outline: 0; }")).toEqual([]);
    // The variants a literal two-string check let through as "ringed".
    expect(parseRingSelectors(".a:focus { outline: 0px; }")).toEqual([]);
    expect(
      parseRingSelectors(".a:focus { outline: none !important; }"),
    ).toEqual([]);
    expect(
      parseRingSelectors(".a:focus { outline: none; outline-offset: 0; }"),
    ).toEqual([]);
    // outline-offset alone paints nothing — it shifts an outline that has to come
    // from elsewhere. `.tabbar:focus-visible { outline-offset: -2px }` is a real
    // rule in this stylesheet, and counting it as a ring put .tabbar in the
    // allowlist twice, so losing the actual rule would have gone unnoticed.
    expect(parseRingSelectors(".a:focus { outline-offset: -2px; }")).toEqual(
      [],
    );
    expect(parseRingSelectors(".a:focus { outline-offset: 4px; }")).toEqual([]);
    // ...but removing the outline while painting something else does count.
    // (parseRingSelectors returns selectors with the pseudo still attached; the
    // module strips it afterwards so jsdom's `matches()` can test the element.)
    expect(
      parseRingSelectors(
        ".a:focus { outline: none; box-shadow: 0 0 0 2px red; }",
      ),
    ).toEqual([".a:focus"]);
    // ...and any focus treatment counts, not just an allow-list of properties.
    expect(parseRingSelectors(".a:focus { left: 0; top: 0; }")).toEqual([
      ".a:focus",
    ]);
  });
});

describe("reduced motion covers every control that animates", () => {
  it("has no transition left running for someone who asked for none", () => {
    // The pain chips declare their own colour transition and were the only
    // interactive control still fading under prefers-reduced-motion, whose own
    // comment promises "make state changes instant (no colour fade) ... on
    // every button". Parsed from the real stylesheet so it cannot drift.
    const css = readFileSync(`${process.cwd()}/src/styles.css`, "utf8").replace(
      /\/\*[\s\S]*?\*\//g,
      "",
    );
    // EVERY reduced-motion block, each matched with its own braces balanced —
    // not "the first one to the last closing brace in the file".
    //
    // That greedy version passed vacuously, and HOW it broke is the point: it
    // was correct when written, because the only reduced-motion block sat AFTER
    // the ordinary `.pain-chip` rules, so the capture held just the allowlist.
    // A later commit added a second block EARLIER in the file, which moved the
    // capture's start above those rules and let `.pain-chip` be found in the
    // wrong place. Nothing touched this test; a change elsewhere in the
    // stylesheet disarmed it.
    const blocks = [
      ...css.matchAll(
        /@media \(prefers-reduced-motion: reduce\) \{((?:[^{}]|\{[^{}]*\})*)\}/g,
      ),
    ].map((m) => m[1]);

    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks.join("\n")).toContain(".pain-chip");
  });
});

describe("the pain chips carry selection in more than hue", () => {
  it("declares a different font-weight for the selected chip", () => {
    // The comment on the selected rule promises fill, border AND weight — and
    // the weight was a no-op, because the global `label` rule already sets 600
    // and the selected state asked for 600 too. Measured in Chrome: all four
    // chips computed 600 either way, so one of the three stated signals did not
    // exist. Read from the stylesheet because jsdom computes nothing from it.
    const css = readFileSync(`${process.cwd()}/src/styles.css`, "utf8").replace(
      /\/\*[\s\S]*?\*\//g,
      "",
    );
    const body = (selector: string) =>
      new RegExp(`(?:^|\\})\\s*${selector}\\s*\\{([^}]*)\\}`, "m").exec(
        css,
      )?.[1] ?? "";
    const weight = (selector: string) =>
      /font-weight:\s*([^;]+)/.exec(body(selector))?.[1].trim();

    const resting = weight("\\.pain-chip");
    const selected = weight("\\.pain-chip--on");
    expect(resting).toBeDefined();
    expect(selected).toBeDefined();
    expect(selected).not.toBe(resting);
  });
});

describe("a state rule has to come after the rule it overrides", () => {
  it("puts the Done button's confirmed state after its base", () => {
    // Both are a single class, so at equal specificity source order decides.
    // Written first, `--confirmed` lost every declaration to the base rule's
    // `background: var(--accent)` — measured in a browser, the button showed
    // "✓ Done" and stayed blue.
    //
    // This is the third time on this branch that a rule placed before the one
    // it overrides has silently done nothing (the saved-value wash's radius and
    // `body`'s base colour were the others), so it is pinned rather than
    // remembered.
    const css = readFileSync(`${process.cwd()}/src/styles.css`, "utf8");
    const base = css.indexOf(".first-shot-card__done-button {");
    const confirmed = css.indexOf(".first-shot-card__done-button--confirmed {");
    expect(base).toBeGreaterThan(-1);
    expect(confirmed).toBeGreaterThan(-1);
    expect(confirmed).toBeGreaterThan(base);
  });

  it("keeps the Done button green under every pointer state", () => {
    /*
     * Source order is only half the rule, and the test above pinned the half
     * that had already bitten. A pseudo-class ADDS SPECIFICITY, so
     * `:hover` (0,2,0) outranks the confirmed state's single class (0,1,0)
     * wherever either one sits — order cannot reach it. The button was
     * screenshotted mid-beat reading "✓ Done" on hover-blue, and since the
     * cursor is by definition still on a button you just clicked, the green
     * confirmation was never visible on desktop at all.
     *
     * Two separate rules did it, and fixing only the obvious one left it
     * broken: the button's own `:hover`, and `.secondary-button:hover/:active`,
     * which sets a background because this is a secondary button. So this
     * asserts the OUTCOME — what colour wins — rather than the presence of any
     * particular override, which is what lets it catch the next rule nobody
     * thought of.
     */
    const css = readFileSync(`${process.cwd()}/src/styles.css`, "utf8");

    // Innermost rules only, so a body containing `{` is not a body — the same
    // nesting-proof shape the SHEET_EXIT_MS guard uses.
    // Comments first: they carry prose containing commas and colons, and this
    // file is heavily commented, so leaving them in feeds sentences to
    // `matches()` as if they were selectors.
    const rules = [
      ...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g),
    ].map(([, selectors, body]) => ({ selectors, body }));

    // (ids, classes+attrs+pseudo-classes, elements). `:not(...)` contributes its
    // argument's specificity, not its own — close enough here, where no ring
    // selector nests one.
    const specificity = (sel: string): number => {
      const bare = sel.replace(/:not\(|\)/g, " ");
      const ids = (bare.match(/#[\w-]+/g) ?? []).length;
      const classes = (bare.match(/\.[\w-]+|\[[^\]]*\]|:[\w-]+(?!\()/g) ?? [])
        .length;
      return ids * 100 + classes * 10;
    };

    const button = document.createElement("button");
    button.className =
      "secondary-button first-shot-card__done-button " +
      "first-shot-card__done-button--confirmed";
    document.body.append(button);

    try {
      // Hovered AND pressed: the worst case, and the real one — you are
      // pressing the button when the ✓ appears.
      const winners: { spec: number; at: number; value: string }[] = [];
      rules.forEach(({ selectors, body }, at) => {
        const background = /(?:^|;)\s*background(?:-color)?:\s*([^;]+)/.exec(
          body,
        )?.[1].trim();
        if (!background) return;
        for (const raw of selectors.split(",")) {
          const sel = raw.trim();
          if (!sel.includes("first-shot-card__done-button") && !sel.includes("secondary-button")) {
            continue;
          }
          // Grant the states we are testing; any OTHER state pseudo means the
          // rule does not apply right now.
          const grounded = sel.replace(/:hover|:active/g, "");
          if (/:[\w-]+/.test(grounded.replace(/:not\([^)]*\)/g, ""))) continue;
          let matches = false;
          try {
            matches = button.matches(grounded);
          } catch {
            throw new Error(`unparseable selector in styles.css: "${sel}"`);
          }
          if (matches) winners.push({ spec: specificity(sel), at, value: background });
        }
      });

      expect(winners.length).toBeGreaterThan(0);
      // Highest specificity wins; ties go to whichever comes last.
      winners.sort((a, b) => a.spec - b.spec || a.at - b.at);
      expect(winners[winners.length - 1].value).toBe("var(--success)");
    } finally {
      button.remove();
    }
  });
});
