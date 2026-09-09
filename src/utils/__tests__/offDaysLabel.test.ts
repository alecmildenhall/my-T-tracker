import { describe, it, expect } from "vitest";
import { OFF_DAYS_PATTERNS } from "../../types/shot";
import {
  offDaysLabel,
  offDaysShortLabel,
  offDaysSpokenLabel,
  offDaysStrip,
} from "../offDaysLabel";

describe("off-days labels", () => {
  it("covers every pattern in all four presentations", () => {
    // A `Record<OffDaysPattern, …>` makes the compiler catch a missing key, but
    // not an empty string — and a blank label renders as a row you cannot read.
    for (const p of OFF_DAYS_PATTERNS) {
      expect(offDaysLabel(p)).toBeTruthy();
      expect(offDaysShortLabel(p)).toBeTruthy();
      expect(offDaysSpokenLabel(p)).toBeTruthy();
      expect(offDaysStrip(p)).toHaveLength(8);
    }
  });

  it("starts every spoken name with its visible label (WCAG 2.5.3)", () => {
    // The rule that makes short labels safe. The visible text must be CONTAINED
    // in the accessible name, and leading with it is what keeps voice control
    // working — "tap Early on" has to match a row whose name continues past it.
    for (const p of OFF_DAYS_PATTERNS) {
      expect(offDaysSpokenLabel(p).startsWith(offDaysShortLabel(p))).toBe(true);
    }
  });

  it("says where the days sat whenever the short label does not", () => {
    // The other half: shortening the words moved the position into the strip,
    // and the strip is aria-hidden. If a positional pattern's spoken name were
    // no longer than its visible label, that information would exist ONLY in
    // dots assistive tech cannot see (WCAG 1.3.1).
    for (const p of ["right-after", "right-before", "here-and-there"] as const) {
      expect(offDaysSpokenLabel(p).length).toBeGreaterThan(
        offDaysShortLabel(p).length,
      );
    }
  });

  it("stands alone where there is no strip beside it", () => {
    // The History facet and the row pill render the answer with no picture and
    // no question above it, so those labels name the shot they anchor to.
    expect(offDaysLabel("right-after")).toBe("Right after the previous shot");
    expect(offDaysLabel("right-before")).toBe("Right before this shot");
    // ...and the short ones deliberately do not, which is why they are separate.
    expect(offDaysShortLabel("right-after")).toBe("Early on");
  });

  it("names two different shots for the two directions", () => {
    // On a row FOR a shot, and in a dropdown with no shot in sight, "the last
    // shot" reads as the one in front of you — the opposite of the stored
    // meaning. The pair only reads as two directions if they anchor differently.
    expect(offDaysLabel("right-after")).toContain("previous shot");
    expect(offDaysLabel("right-before")).toContain("this shot");
    // EVERY set, not just the visible one. The rule was applied to two of the
    // three and missed on the spoken labels, where only a screen-reader user
    // would have heard "your last shot" beside a span saying "your previous".
    for (const p of OFF_DAYS_PATTERNS) {
      expect(offDaysLabel(p)).not.toContain("last shot");
      expect(offDaysShortLabel(p)).not.toContain("last shot");
      expect(offDaysSpokenLabel(p)).not.toContain("last shot");
    }
  });

  it("draws the three positional patterns with the same number of days", () => {
    // The reason the strip exists. A count cannot tell these apart; only the
    // position can, and that is the insight the whole field is built on.
    const lit = (p: Parameters<typeof offDaysStrip>[0]) =>
      offDaysStrip(p).filter(Boolean).length;
    expect(lit("right-after")).toBe(3);
    expect(lit("here-and-there")).toBe(3);
    expect(lit("right-before")).toBe(3);
  });

  it("puts the lit days where the label says they are", () => {
    const strip = (p: Parameters<typeof offDaysStrip>[0]) => offDaysStrip(p);
    // Nothing at all.
    expect(strip("none").some(Boolean)).toBe(false);
    // Clustered at the start, and nothing in the last half.
    expect(strip("right-after").slice(0, 3).every(Boolean)).toBe(true);
    expect(strip("right-after").slice(4).some(Boolean)).toBe(false);
    // Clustered at the end, and nothing in the first half.
    expect(strip("right-before").slice(5).every(Boolean)).toBe(true);
    expect(strip("right-before").slice(0, 4).some(Boolean)).toBe(false);
    // Scattered: present in both halves, and not contiguous.
    const here = strip("here-and-there");
    expect(here.slice(0, 4).some(Boolean)).toBe(true);
    expect(here.slice(4).some(Boolean)).toBe(true);
  });

  it("walks the interval in declaration order, so the strip reads as an index", () => {
    // The rows render in `OFF_DAYS_PATTERNS` order, and the ordering is what
    // makes the strip scannable: nothing, the start, scattered, the end, most.
    const centre = (p: Parameters<typeof offDaysStrip>[0]) => {
      const on = offDaysStrip(p)
        .map((v, i) => (v ? i : -1))
        .filter((i) => i >= 0);
      return on.reduce((a, b) => a + b, 0) / on.length;
    };
    expect(centre("right-after")).toBeLessThan(centre("here-and-there"));
    expect(centre("here-and-there")).toBeLessThan(centre("right-before"));
  });
});
