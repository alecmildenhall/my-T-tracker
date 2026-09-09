import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const readRoot = (file: string) => readFileSync(resolve(root, file), "utf-8");

/**
 * The favicon is the app's most public surface -- a browser tab, a home screen,
 * the app switcher -- and it fails silently: SVG is strict XML, so a malformed
 * file is not a broken drawing, it is nothing at all, and the tab falls back to
 * a blank page glyph. That is exactly what shipped for a moment here, from a
 * `--` inside an XML comment, which is illegal and which every editor and the
 * build were perfectly happy with.
 *
 * So this asserts the outcome the icon exists for -- it parses, and the document
 * actually points at it -- rather than that a file is present.
 */
describe("app icon", () => {
  it("is well-formed XML with an <svg> root", () => {
    const parsed = new DOMParser().parseFromString(
      readRoot("public/icon.svg"),
      "image/svg+xml"
    );
    expect(parsed.querySelector("parsererror")).toBeNull();
    expect(parsed.documentElement.tagName).toBe("svg");
  });

  it("is the icon index.html points at, under the app's own name", () => {
    const html = readRoot("index.html");
    expect(html).toContain('href="/icon.svg"');
    expect(html).toContain("<title>T-Shot Tracker</title>");
  });
});
