import { describe, it, expect } from "vitest";
import {
  monthsOnT,
  addMonthsCivil,
  daysBetweenCivil,
  mostRecentThreshold,
  milestoneLabel,
  currentMilestone,
  celebrationWindowDays,
  YEAR_ONE_WINDOW_DAYS,
  LATER_WINDOW_DAYS,
} from "../milestones";

describe("monthsOnT", () => {
  it("counts whole civil months, not completing until the day-of-month is reached", () => {
    expect(monthsOnT("2025-01-15", "2025-02-14")).toBe(0); // day not yet reached
    expect(monthsOnT("2025-01-15", "2025-02-15")).toBe(1); // exactly one month
    expect(monthsOnT("2025-01-15", "2025-02-16")).toBe(1);
    expect(monthsOnT("2025-01-15", "2026-01-15")).toBe(12); // one year
  });

  it("completes a month-end start on the short month's last day (matches the clamp)", () => {
    // Jan 31 start: Feb can't reach day 31, so 1 month lands on Feb's last day.
    expect(monthsOnT("2024-01-31", "2024-02-28")).toBe(0); // not the last day yet
    expect(monthsOnT("2024-01-31", "2024-02-29")).toBe(1); // leap-year last day
    expect(monthsOnT("2025-01-31", "2025-02-28")).toBe(1); // non-leap last day
    // And the clamped anniversary date agrees with monthsOnT.
    expect(addMonthsCivil("2024-01-31", 1)).toBe("2024-02-29");
  });

  it("is negative for a future start date", () => {
    expect(monthsOnT("2026-01-15", "2025-01-15")).toBeLessThan(0);
  });

  it("returns NaN for a malformed or impossible date", () => {
    expect(monthsOnT("2025-1-5", "2025-02-15")).toBeNaN();
    expect(monthsOnT("2025-01-15", "not-a-date")).toBeNaN();
    // Shape-valid but impossible dates are rejected via the shared parseCivilDate.
    expect(monthsOnT("2026-13-40", "2025-02-15")).toBeNaN();
  });
});

describe("addMonthsCivil", () => {
  it("adds months within and across a year", () => {
    expect(addMonthsCivil("2025-01-15", 3)).toBe("2025-04-15");
    expect(addMonthsCivil("2025-11-10", 3)).toBe("2026-02-10");
    expect(addMonthsCivil("2025-01-15", 12)).toBe("2026-01-15");
  });

  it("clamps the day to the target month's length", () => {
    expect(addMonthsCivil("2025-01-31", 1)).toBe("2025-02-28"); // Feb, non-leap
    expect(addMonthsCivil("2024-01-31", 1)).toBe("2024-02-29"); // Feb, leap
    expect(addMonthsCivil("2025-03-31", 1)).toBe("2025-04-30"); // Apr has 30
  });

  it("returns the input unchanged for a malformed date", () => {
    expect(addMonthsCivil("nope", 3)).toBe("nope");
  });
});

describe("daysBetweenCivil", () => {
  it("counts calendar days", () => {
    expect(daysBetweenCivil("2025-02-15", "2025-02-15")).toBe(0);
    expect(daysBetweenCivil("2025-02-15", "2025-03-01")).toBe(14);
    expect(daysBetweenCivil("2025-03-01", "2025-02-15")).toBe(-14);
  });

  it("is DST-proof (spring-forward week counts as 7 days)", () => {
    // US DST began 2025-03-09; a naive local-midnight diff would be off by an hour.
    expect(daysBetweenCivil("2025-03-08", "2025-03-15")).toBe(7);
  });

  it("returns NaN when either date is malformed", () => {
    expect(daysBetweenCivil("bad", "2025-03-15")).toBeNaN();
    expect(daysBetweenCivil("2025-03-08", "bad")).toBeNaN();
  });
});

describe("mostRecentThreshold", () => {
  it("is null under one month", () => {
    expect(mostRecentThreshold(0)).toBeNull();
    expect(mostRecentThreshold(0.5)).toBeNull();
    expect(mostRecentThreshold(NaN)).toBeNull();
  });

  it("steps every month through the first year", () => {
    expect(mostRecentThreshold(1)).toBe(1);
    expect(mostRecentThreshold(5)).toBe(5);
    expect(mostRecentThreshold(11)).toBe(11);
    expect(mostRecentThreshold(12)).toBe(12);
  });

  it("steps every three months through the second year", () => {
    expect(mostRecentThreshold(13)).toBe(12); // last was 1 year; next is 15
    expect(mostRecentThreshold(15)).toBe(15);
    expect(mostRecentThreshold(18)).toBe(18);
    expect(mostRecentThreshold(23)).toBe(21);
    expect(mostRecentThreshold(24)).toBe(24);
  });

  it("steps every six months after two years", () => {
    expect(mostRecentThreshold(25)).toBe(24); // last was 2 years; next is 30
    expect(mostRecentThreshold(30)).toBe(30);
    expect(mostRecentThreshold(35)).toBe(30);
    expect(mostRecentThreshold(36)).toBe(36);
  });
});

describe("milestoneLabel", () => {
  it("expresses years + months, never months-only past a year, singular at 1", () => {
    expect(milestoneLabel(1)).toBe("1 month");
    expect(milestoneLabel(2)).toBe("2 months");
    expect(milestoneLabel(11)).toBe("11 months");
    expect(milestoneLabel(12)).toBe("1 year");
    expect(milestoneLabel(15)).toBe("1 year 3 months");
    expect(milestoneLabel(18)).toBe("1 year 6 months");
    expect(milestoneLabel(24)).toBe("2 years");
    expect(milestoneLabel(30)).toBe("2 years 6 months");
    expect(milestoneLabel(36)).toBe("3 years");
  });
});

describe("celebrationWindowDays", () => {
  it("is short for year-one monthly milestones, full for whole-year anniversaries and later", () => {
    expect(celebrationWindowDays(1)).toBe(YEAR_ONE_WINDOW_DAYS);
    expect(celebrationWindowDays(11)).toBe(YEAR_ONE_WINDOW_DAYS);
    expect(celebrationWindowDays(12)).toBe(LATER_WINDOW_DAYS); // 1 year — anniversary lingers
    expect(celebrationWindowDays(15)).toBe(LATER_WINDOW_DAYS);
    expect(celebrationWindowDays(24)).toBe(LATER_WINDOW_DAYS); // 2 years
    expect(celebrationWindowDays(36)).toBe(LATER_WINDOW_DAYS); // 3 years
  });
});

describe("currentMilestone", () => {
  it("returns null when no start date is set", () => {
    expect(currentMilestone(undefined, "2025-06-01")).toBeNull();
  });

  it("returns null for a future start date", () => {
    expect(currentMilestone("2026-01-01", "2025-06-01")).toBeNull();
  });

  it("returns null for an impossible start date (shared strict parse)", () => {
    expect(currentMilestone("2026-13-40", "2027-01-01")).toBeNull();
  });

  it("returns null before the first (1-month) milestone", () => {
    expect(currentMilestone("2025-01-15", "2025-02-10")).toBeNull();
  });

  it("celebrates on the exact milestone date", () => {
    expect(currentMilestone("2025-01-15", "2025-02-15")).toEqual({
      months: 1,
      label: "1 month",
      date: "2025-02-15",
    });
  });

  it("never shows a milestone before its date (not even the day before)", () => {
    // The 2-month milestone date is 2025-03-15. The day before shows nothing (the
    // 1-month window ended long ago and the 2-month one hasn't arrived).
    expect(currentMilestone("2025-01-15", "2025-03-14")).toBeNull();
    // ...and it appears exactly on the date.
    expect(currentMilestone("2025-01-15", "2025-03-15")?.months).toBe(2);
  });

  it("keeps a year-one milestone within its 7-day window (inclusive of the last day)", () => {
    const within = currentMilestone("2025-01-15", "2025-02-20"); // +5 days
    expect(within?.months).toBe(1);
    const edge = currentMilestone(
      "2025-01-15",
      addDays("2025-02-15", YEAR_ONE_WINDOW_DAYS) // +7
    );
    expect(edge?.months).toBe(1);
  });

  it("stops celebrating a year-one milestone once its 7-day window has passed", () => {
    const past = currentMilestone(
      "2025-01-15",
      addDays("2025-02-15", YEAR_ONE_WINDOW_DAYS + 1) // +8
    );
    expect(past).toBeNull();
  });

  it("gives later milestones the full 14-day window", () => {
    // 15-month milestone date is 2026-04-15. At +10 days it still shows (a year-one
    // milestone would already be gone by +8), and it ends at +14.
    expect(currentMilestone("2025-01-15", "2026-04-25")?.months).toBe(15); // +10
    expect(
      currentMilestone("2025-01-15", addDays("2026-04-15", LATER_WINDOW_DAYS))
        ?.months
    ).toBe(15); // +14
    expect(
      currentMilestone("2025-01-15", addDays("2026-04-15", LATER_WINDOW_DAYS + 1))
    ).toBeNull(); // +15
  });

  it("celebrates the one-year milestone", () => {
    expect(currentMilestone("2025-01-15", "2026-01-20")).toEqual({
      months: 12,
      label: "1 year",
      date: "2026-01-15",
    });
  });

  it("gives whole-year anniversaries the full 14-day window", () => {
    // 1-year date is 2026-01-15. It still shows at +10 days (a year-one monthly
    // milestone would already be gone by +8), and ends at +14.
    expect(currentMilestone("2025-01-15", "2026-01-25")?.months).toBe(12); // +10
    expect(
      currentMilestone("2025-01-15", addDays("2026-01-15", LATER_WINDOW_DAYS))
        ?.months
    ).toBe(12); // +14
    expect(
      currentMilestone("2025-01-15", addDays("2026-01-15", LATER_WINDOW_DAYS + 1))
    ).toBeNull(); // +15
  });

  it("uses three-month cadence in the second year", () => {
    // 15 months from 2025-01-15 is 2026-04-15; within window.
    expect(currentMilestone("2025-01-15", "2026-04-18")).toEqual({
      months: 15,
      label: "1 year 3 months",
      date: "2026-04-15",
    });
  });

  it("uses six-month cadence after two years", () => {
    // 30 months from 2025-01-15 is 2027-07-15; within window.
    expect(currentMilestone("2025-01-15", "2027-07-18")).toEqual({
      months: 30,
      label: "2 years 6 months",
      date: "2027-07-15",
    });
  });

  it("celebrates a month-end start on the short month's last day (no off-by-one)", () => {
    // Jan 31 start -> 1-month milestone lands on Feb 29 (leap) and shows there.
    expect(currentMilestone("2024-01-31", "2024-02-29")).toEqual({
      months: 1,
      label: "1 month",
      date: "2024-02-29",
    });
    // ...and not the day before.
    expect(currentMilestone("2024-01-31", "2024-02-28")).toBeNull();
  });

  it("surfaces only the latest milestone, and only in its window (not a stale one)", () => {
    // ~18 days past the 1-month date and before the 2-month date: nothing shows.
    expect(currentMilestone("2025-01-15", "2025-03-05")).toBeNull();
  });
});

/** Test helper: add whole days to a civil date via UTC anchoring. */
function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(
    t.getUTCDate()
  ).padStart(2, "0")}`;
}
