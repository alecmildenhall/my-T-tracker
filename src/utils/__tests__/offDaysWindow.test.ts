import { describe, it, expect } from "vitest";
import { offDaysWindowDays, offDaysWindowLabel } from "../offDaysWindow";

const shot = (id: string, date: string) => ({ id, date });

describe("offDaysWindowDays", () => {
  it("measures back to the most recent earlier shot", () => {
    const shots = [
      shot("a", "2026-07-01"),
      shot("b", "2026-08-12"),
      shot("c", "2026-06-01"),
    ];
    expect(offDaysWindowDays(shots, "2026-08-25")).toBe(13);
  });

  it("ignores shots after the one being logged", () => {
    // Backdating an entry asks about the gap before IT, not before today.
    const shots = [shot("a", "2026-08-12"), shot("b", "2026-09-30")];
    expect(offDaysWindowDays(shots, "2026-08-19")).toBe(7);
  });

  it("has no window for the first shot", () => {
    // Not a failure: the question is still asked, because someone logging their
    // first shot here may have been injecting for years. The app just cannot
    // name the span, so it says nothing rather than guessing.
    expect(offDaysWindowDays([], "2026-08-25")).toBeNull();
  });

  it("measures a same-day repeat as zero, not as unknown", () => {
    // This returned `null` once, which made "the gap is zero" indistinguishable
    // from "there is no previous shot" — and they render the same, so the one
    // case the app knows EXACTLY looked like the case it knows nothing about.
    // `null` is for unknowable only.
    const shots = [shot("a", "2026-08-25")];
    expect(offDaysWindowDays(shots, "2026-08-25")).toBe(0);
  });

  it("does not let a shot be its own predecessor when edited", () => {
    const shots = [shot("a", "2026-08-12"), shot("b", "2026-08-25")];
    expect(offDaysWindowDays(shots, "2026-08-25", "b")).toBe(13);
  });

  it("says nothing for a date it cannot parse", () => {
    // Every date is unparseable halfway through being typed, and a date input
    // reports partial values. A guess here would flicker a wrong span.
    const shots = [shot("a", "2026-08-12")];
    for (const bad of ["", "2026-08", "not-a-date", "0008-08-05", "9999-01-01"]) {
      expect(offDaysWindowDays(shots, bad)).toBeNull();
    }
  });

  it("ignores a stored date outside the supported range", () => {
    // Storage is lenient, so a legacy out-of-range date can sit in the list.
    // Measuring from it would print a span in the thousands of days.
    const shots = [shot("a", "0999-01-01")];
    expect(offDaysWindowDays(shots, "2026-08-25")).toBeNull();
  });
});

describe("offDaysWindowLabel", () => {
  it("reads 'today' for a zero-length window, never '0 days'", () => {
    // Both are true; only one is readable at a sharps bin. Same instinct as
    // "first shot" rather than "0 days late".
    expect(offDaysWindowLabel(0)).toBe("Since your previous shot · today");
  });

  it("names the window relative to THIS shot, not to your latest one", () => {
    // "Since your last shot" was the first wording and is false where it
    // matters: editing an entry from months ago measures the gap before IT,
    // correctly, while "your last shot" means the recent one — so the words and
    // the number described different things.
    expect(offDaysWindowLabel(13)).toBe("Since your previous shot · 13 days");
    expect(offDaysWindowLabel(13)).not.toContain("last shot");
  });

  it("says 'day' for one", () => {
    expect(offDaysWindowLabel(1)).toBe("Since your previous shot · 1 day");
  });

  it("still names the window when it cannot measure it", () => {
    // The whole point of the change. A first entry has no predecessor, so the
    // length is unknown — but "since your previous shot" is still true, because
    // the person logging it has one even when the app does not. Dropping the
    // line entirely left the one shot with least context saying nothing.
    expect(offDaysWindowLabel(null)).toBe("Since your previous shot");
  });

  it("never returns null, so the anchor cannot go missing", () => {
    for (const d of [null, 1, 3, 13, 90]) {
      expect(offDaysWindowLabel(d)).toContain("Since your previous shot");
    }
  });
});
