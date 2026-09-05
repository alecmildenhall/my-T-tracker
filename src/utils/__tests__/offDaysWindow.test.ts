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

  it("has no window for a same-day repeat", () => {
    // A zero-length window has no days in it to have felt off. The predecessor
    // helper deliberately counts a same-day shot as the one before — right for
    // the schedule, where two entries on one day are a plausible mis-log — so
    // the decision that it is not a WINDOW belongs here.
    const shots = [shot("a", "2026-08-25")];
    expect(offDaysWindowDays(shots, "2026-08-25")).toBeNull();
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
  it("names the span in days", () => {
    expect(offDaysWindowLabel(13)).toBe("Since your last shot · 13 days");
  });

  it("says 'day' for one", () => {
    expect(offDaysWindowLabel(1)).toBe("Since your last shot · 1 day");
  });

  it("says nothing when the window is unknown", () => {
    expect(offDaysWindowLabel(null)).toBeNull();
  });
});
