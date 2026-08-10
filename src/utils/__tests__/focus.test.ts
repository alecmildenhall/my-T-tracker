import { describe, it, expect, afterEach } from "vitest";
import { handOffFocus } from "../focus";

const mounted = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  init?: (el: HTMLElementTagNameMap[K]) => void
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
    expect(parseRingSelectors(".a:focus { outline: none !important; }")).toEqual([]);
    expect(
      parseRingSelectors(".a:focus { outline: none; outline-offset: 0; }")
    ).toEqual([]);
    // ...but removing the outline while painting something else does count.
    // (parseRingSelectors returns selectors with the pseudo still attached; the
    // module strips it afterwards so jsdom's `matches()` can test the element.)
    expect(
      parseRingSelectors(".a:focus { outline: none; box-shadow: 0 0 0 2px red; }")
    ).toEqual([".a:focus"]);
    // ...and any focus treatment counts, not just an allow-list of properties.
    expect(parseRingSelectors(".a:focus { left: 0; top: 0; }")).toEqual([".a:focus"]);
  });
});
