import { describe, it, expect } from "vitest";
import { resolveGreeting } from "../greeting";
import type { Profile } from "../../types/profile";

// A start date whose 1-year milestone window is active on the chosen "today".
const START = "2025-01-15";
const ONE_YEAR_DAY = "2026-01-15"; // exactly 12 months → "1 year"
const ORDINARY_DAY = "2025-08-01"; // ~6.5 months in, between milestone windows

const profile = (over: Partial<Profile> = {}): Profile => ({ ...over });

describe("resolveGreeting — milestone (top priority)", () => {
  it("celebrates with the name", () => {
    expect(
      resolveGreeting(profile({ startDate: START, preferredName: "Lou" }), true, ONE_YEAR_DAY)
    ).toBe("Congrats on 1 year on T, Lou!");
  });

  it("celebrates without a name", () => {
    expect(resolveGreeting(profile({ startDate: START }), true, ONE_YEAR_DAY)).toBe(
      "Congrats on 1 year on T!"
    );
  });

  it("outranks the first-time welcome (first-day anniversary still celebrates)", () => {
    // Brand-new user (no shots) who set a past start date landing on a milestone.
    expect(
      resolveGreeting(profile({ startDate: START, preferredName: "Lou" }), false, ONE_YEAR_DAY)
    ).toBe("Congrats on 1 year on T, Lou!");
  });
});

describe("resolveGreeting — first-time (no shots, no active milestone)", () => {
  it("welcomes with the name", () => {
    expect(resolveGreeting(profile({ preferredName: "Lou" }), false, ORDINARY_DAY)).toBe(
      "Welcome, Lou :)"
    );
  });

  it("welcomes without a name", () => {
    expect(resolveGreeting(profile(), false, ORDINARY_DAY)).toBe("Welcome :)");
  });

  it("still welcomes when a start date is set but no milestone is active", () => {
    expect(resolveGreeting(profile({ startDate: START }), false, ORDINARY_DAY)).toBe(
      "Welcome :)"
    );
  });
});

describe("resolveGreeting — returning (has shots, no active milestone)", () => {
  it("greets with the name", () => {
    expect(resolveGreeting(profile({ preferredName: "Lou" }), true, ORDINARY_DAY)).toBe(
      "Hi, Lou~"
    );
  });

  it("greets without a name", () => {
    expect(resolveGreeting(profile(), true, ORDINARY_DAY)).toBe("Hi there~");
  });
});

describe("resolveGreeting — name handling", () => {
  it("treats a blank name as absent", () => {
    expect(resolveGreeting(profile({ preferredName: "" }), true, ORDINARY_DAY)).toBe(
      "Hi there~"
    );
  });

  it("keeps a name with internal spaces", () => {
    expect(
      resolveGreeting(profile({ preferredName: "Lou Smith" }), true, ORDINARY_DAY)
    ).toBe("Hi, Lou Smith~");
  });

  it("never contains a non-ASCII/emoji character in any state", () => {
    // Guard against the missing-glyph "tofu": every permutation must be plain text.
    const messages = [
      resolveGreeting(profile({ startDate: START, preferredName: "Lou" }), true, ONE_YEAR_DAY),
      resolveGreeting(profile({ startDate: START }), true, ONE_YEAR_DAY),
      resolveGreeting(profile({ preferredName: "Lou" }), false, ORDINARY_DAY),
      resolveGreeting(profile(), false, ORDINARY_DAY),
      resolveGreeting(profile({ preferredName: "Lou" }), true, ORDINARY_DAY),
      resolveGreeting(profile(), true, ORDINARY_DAY),
    ];
    for (const msg of messages) {
      // eslint-disable-next-line no-control-regex
      expect(msg).toMatch(/^[\x00-\x7F]*$/); // ASCII-only, no emoji
    }
  });
});
