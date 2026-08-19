import { describe, it, expect, afterEach } from "vitest";
import { tabbablesIn } from "../tabbing";

/**
 * Builds a detached-then-attached container. Attached matters: `tabbable`
 * reverts to its legacy behaviour for a container outside the document, which
 * would make these tests pass for the wrong reason.
 */
function mount(html: string): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
}

const names = (els: HTMLElement[]) =>
  els.map((el) => el.getAttribute("data-n") ?? el.tagName.toLowerCase());

afterEach(() => {
  document.body.innerHTML = "";
});

describe("tabbablesIn", () => {
  it("finds ordinary controls in document order", () => {
    const root = mount(`
      <button data-n="a"></button>
      <input data-n="b" />
      <a href="#x" data-n="c"></a>
      <textarea data-n="d"></textarea>
      <select data-n="e"></select>
    `);
    expect(names(tabbablesIn(root))).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("excludes disabled controls and negative tabindex", () => {
    // Both were expressible in the old CSS selector, and both took several
    // rounds to get right there — a disabled button sat in the list and made
    // every index-based question about it wrong.
    const root = mount(`
      <button data-n="a"></button>
      <button data-n="skip-disabled" disabled></button>
      <button data-n="skip-negative" tabindex="-1"></button>
      <button data-n="skip-both" disabled tabindex="0"></button>
      <button data-n="b"></button>
    `);
    expect(names(tabbablesIn(root))).toEqual(["a", "b"]);
  });

  it("excludes controls inside a disabled fieldset", () => {
    // THE case this dependency was taken for. A <fieldset disabled> puts no
    // `disabled` attribute on its children, so no selector can see it — and
    // grouping fields in a fieldset is exactly how slice B½ would build the
    // log sheet's new sections. Every child would have sat in the list looking
    // reachable.
    const root = mount(`
      <button data-n="a"></button>
      <fieldset disabled>
        <input data-n="skip-inside-group" />
        <button data-n="skip-inside-group-too"></button>
      </fieldset>
      <button data-n="b"></button>
    `);
    expect(names(tabbablesIn(root))).toEqual(["a", "b"]);
  });

  it("keeps the first legend's controls in a disabled fieldset, as browsers do", () => {
    // The one exception in the spec, and worth pinning: a disabled fieldset
    // still exposes controls in its FIRST <legend>.
    const root = mount(`
      <fieldset disabled>
        <legend><input data-n="in-legend" /></legend>
        <input data-n="skip" />
      </fieldset>
    `);
    expect(names(tabbablesIn(root))).toEqual(["in-legend"]);
  });

  it("excludes content inside a closed <details>", () => {
    const root = mount(`
      <details>
        <summary data-n="summary"></summary>
        <button data-n="skip-collapsed"></button>
      </details>
      <button data-n="after"></button>
    `);
    expect(names(tabbablesIn(root))).toEqual(["summary", "after"]);
  });

  it("includes content of an open <details>", () => {
    const root = mount(`
      <details open>
        <summary data-n="summary"></summary>
        <button data-n="inside"></button>
      </details>
    `);
    expect(names(tabbablesIn(root))).toEqual(["summary", "inside"]);
  });

  it("skips unchecked radios when another in the group is checked", () => {
    // Tab reaches the checked one only. The pain and mood chips B½ adds are the
    // obvious candidates for a radiogroup, so this stops being hypothetical.
    const root = mount(`
      <input type="radio" name="g" data-n="skip-unchecked" />
      <input type="radio" name="g" data-n="checked" checked />
      <input type="radio" name="g" data-n="skip-unchecked-too" />
    `);
    expect(names(tabbablesIn(root))).toEqual(["checked"]);
  });

  it("orders by tabindex, not just document order", () => {
    // The old selector returned document order and the trap relied on that,
    // guarded only by a comment saying nothing in this app uses a positive
    // tabIndex. True, and load-bearing; now it is neither.
    const root = mount(`
      <button data-n="natural-1"></button>
      <button data-n="positive-2" tabindex="2"></button>
      <button data-n="natural-2"></button>
      <button data-n="positive-1" tabindex="1"></button>
    `);
    expect(names(tabbablesIn(root))).toEqual([
      "positive-1",
      "positive-2",
      "natural-1",
      "natural-2",
    ]);
  });

  it("does not include the container itself", () => {
    // The trap appends the dialog as its own last-resort floor; having it show
    // up inside the list too would make it a rotation step.
    const root = mount(`<button data-n="a"></button>`);
    root.tabIndex = -1;
    expect(names(tabbablesIn(root))).toEqual(["a"]);
  });

  it("returns only HTMLElements, so handOffFocus cannot be handed an SVG", () => {
    // `tabbable` returns HTMLElement | SVGElement, and handOffFocus resolves
    // anything that is not an HTMLElement by reading `.current` off it — which
    // for an SVGElement is undefined, and then throws on `.isConnected`.
    const root = mount(`
      <button data-n="a"></button>
      <svg tabindex="0"><circle /></svg>
    `);
    const found = tabbablesIn(root);
    expect(found.every((el) => el instanceof HTMLElement)).toBe(true);
    expect(names(found)).toEqual(["a"]);
  });
});
