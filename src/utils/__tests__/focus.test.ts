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
