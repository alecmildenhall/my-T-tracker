import { describe, it, expect } from "vitest";
import {
  addDaysCivil,
  scheduleMode,
  plannedDateRolling,
  previousShotDateBefore,
  snapToWeekday,
  establishAnchor,
  plannedDateFor,
  planShot,
  daysFromPlanned,
} from "../schedule";
import { WEEKDAYS, weekdayOf } from "../weekday";

/** 5 Aug 2026 is a Wednesday — the anchor day for every scenario below. */
const WED = "2026-08-05";
const day = (n: number) => addDaysCivil(WED, n);

/**
 * Run a user's whole history through the grid and describe each shot the way
 * the UI would. These are the six patterns the design was chosen by: three
 * earlier designs passed some of them and failed others, and the failures are
 * what the fixed grid exists to prevent.
 */
function history(
  actuals: string[],
  shotDay = "wednesday" as const,
  interval = 7,
) {
  // The anchor is established ONCE from the first shot and frozen, exactly as
  // the profile now stores it — not recomputed from whatever is earliest.
  const anchor = establishAnchor(actuals[0], shotDay, interval)!;
  return actuals.map((actual) => {
    const planned = plannedDateFor(actual, anchor, interval)!;
    const delta = daysFromPlanned({ date: actual, plannedFor: planned })!;
    return delta === 0
      ? "on time"
      : delta > 0
        ? `${delta} after`
        : `${-delta} before`;
  });
}

describe("addDaysCivil", () => {
  it("moves whole days without tripping over month or year ends", () => {
    expect(addDaysCivil("2026-08-05", 7)).toBe("2026-08-12");
    expect(addDaysCivil("2026-08-30", 7)).toBe("2026-09-06");
    expect(addDaysCivil("2026-12-29", 7)).toBe("2027-01-05");
    expect(addDaysCivil("2026-08-05", -7)).toBe("2026-07-29");
  });

  it("crosses a DST boundary without gaining or losing a day", () => {
    // The UTC-midnight technique, same as daysBetweenCivil. A local-time
    // implementation drifts by an hour here and can land on the wrong date.
    expect(addDaysCivil("2026-03-28", 1)).toBe("2026-03-29"); // EU spring forward
    expect(addDaysCivil("2026-10-24", 1)).toBe("2026-10-25"); // EU fall back
    expect(addDaysCivil("2026-03-07", 1)).toBe("2026-03-08"); // US spring forward
  });

  it("handles a leap day", () => {
    expect(addDaysCivil("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDaysCivil("2028-02-29", 1)).toBe("2028-03-01");
  });

  it("returns the input unchanged when it cannot parse", () => {
    expect(addDaysCivil("not-a-date", 7)).toBe("not-a-date");
  });

  it("pads a three-digit year, so the result is always YYYY-MM-DD", () => {
    // Unpadded this returned "999-01-08", which fails CIVIL_DATE_RE everywhere
    // downstream. civilDateParts accepts years 100–999, so it is reachable.
    expect(addDaysCivil("0999-01-01", 7)).toBe("0999-01-08");
  });

  it("returns the input rather than a date its own parser would reject", () => {
    // An earlier version of the test above pinned "0099-12-31" as the expected
    // output, which is junk: civilDateParts rejects years under 100, so that
    // string would have flowed on as if it were a date. Padding fixed the
    // middle of the range and not the ends — a year past 9999 gives five
    // digits, a negative gives "00-1". Rather than enumerate the ways the
    // output can be unusable, it is parsed back and refused if it does not
    // survive.
    expect(addDaysCivil("0100-01-01", -1)).toBe("0100-01-01");
    expect(addDaysCivil("9999-12-01", 400)).toBe("9999-12-01");
  });

  it("refuses a non-finite day count rather than emitting NaN-NaN-NaN", () => {
    expect(addDaysCivil("2026-08-05", NaN)).toBe("2026-08-05");
    expect(addDaysCivil("2026-08-05", Infinity)).toBe("2026-08-05");
  });
});

describe("establishAnchor", () => {
  it("snaps the first shot to the nearest shot day", () => {
    // A first shot taken one day early still anchors the grid to Wednesday —
    // which is the entire reason shot day is required.
    expect(establishAnchor(day(-1), "wednesday", 7)).toBe(WED);
    expect(establishAnchor(day(1), "wednesday", 7)).toBe(WED);
    expect(establishAnchor(WED, "wednesday", 7)).toBe(WED);
  });

  it("picks the nearer occurrence when a shot sits between two", () => {
    // Sunday is 4 days after one Wednesday and 3 before the next.
    expect(establishAnchor(day(4), "wednesday", 7)).toBe(day(7));
  });

  it("is null for a date it cannot read", () => {
    expect(establishAnchor("nope", "wednesday", 7)).toBeNull();
  });
});

describe("establishAnchor — cadences a weekday cannot describe", () => {
  it("refuses to anchor anything that is not a whole number of weeks", () => {
    // Snapping only aligns the grid when the interval is a multiple of 7. On a
    // 10-day cadence the grid walks across the week, so the snap injects a
    // fixed offset every shot then carries, frozen. Measured before the guard:
    // a user injecting EXACTLY every 10 days read "3 days before" on all of
    // them, forever — the failure this module's header rejects.
    for (const interval of [1, 3, 10, 13, 30]) {
      expect(establishAnchor("2026-08-09", "wednesday", interval)).toBeNull();
    }
  });

  it("anchors every whole number of weeks", () => {
    for (const interval of [7, 14, 21, 28]) {
      expect(establishAnchor(day(-1), "wednesday", interval)).toBe(WED);
    }
  });

  it("refuses an out-of-range interval outright", () => {
    expect(establishAnchor(WED, "wednesday", 0)).toBeNull();
    expect(establishAnchor(WED, "wednesday", 7.5)).toBeNull();
    expect(establishAnchor(WED, "wednesday", 371)).toBeNull(); // > 365
  });
});

describe("establishAnchor — refusing to mint what the boundaries drop", () => {
  it("returns null rather than an anchor outside the storable range", () => {
    // Snapping moves up to 3 days either way, so it can step past the range
    // every persistence boundary enforces. Each of them would have dropped it
    // silently, leaving the user with no planned dates and nothing explaining
    // why — so the producer refuses instead.
    expect(establishAnchor("1900-01-01", "sunday", 7)).toBeNull();
  });
});

describe("snapToWeekday", () => {
  it("reaches every weekday from any day, within half a week", () => {
    for (const target of WEEKDAYS) {
      for (let offset = 0; offset < 7; offset++) {
        const snapped = snapToWeekday(day(offset), target)!;
        expect(weekdayOf(snapped)).toBe(target);
        expect(
          Math.abs(
            daysFromPlanned({ date: day(offset), plannedFor: snapped })!,
          ),
        ).toBeLessThanOrEqual(3);
      }
    }
  });
});

describe("plannedDateFor", () => {
  it("claims the nearest slot", () => {
    expect(plannedDateFor(WED, WED, 7)).toBe(WED);
    expect(plannedDateFor(day(8), WED, 7)).toBe(day(7));
    expect(plannedDateFor(day(13), WED, 7)).toBe(day(14));
  });

  it("gives an exact midpoint to the LATER slot, on both sides of the anchor", () => {
    // A behaviour, not an implementation: this cannot distinguish
    // `floor(x + 0.5)` from `Math.round`, because in JavaScript they are the
    // same function. It pins which way a tie falls, which is the part a future
    // edit could change without noticing.
    const interval = 8; // even, so half of it is a whole number of days
    expect(plannedDateFor(day(4), WED, interval)).toBe(day(8));
    expect(plannedDateFor(day(-4), WED, interval)).toBe(WED);
  });

  it("works for a shot before the anchor", () => {
    expect(plannedDateFor(day(-7), WED, 7)).toBe(day(-7));
    expect(plannedDateFor(day(-6), WED, 7)).toBe(day(-7));
  });

  it("works for a fortnightly grid", () => {
    expect(plannedDateFor(day(14), WED, 14)).toBe(day(14));
    expect(plannedDateFor(day(15), WED, 14)).toBe(day(14));
    expect(plannedDateFor(day(7), WED, 14)).toBe(day(14)); // nearest, rounding up
  });
});

describe("the six user patterns the design was chosen by", () => {
  it("never misses: every shot on time", () => {
    expect(history([0, 7, 14, 21, 28].map(day))).toEqual([
      "on time",
      "on time",
      "on time",
      "on time",
      "on time",
    ]);
  });

  it("always two days late: reads 2 after every time, and never drifts", () => {
    // Chaining on the previous ACTUAL shot made this read "on time" forever,
    // because each late shot became the new schedule.
    expect(history([2, 9, 16, 23, 30].map(day))).toEqual([
      "2 after",
      "2 after",
      "2 after",
      "2 after",
      "2 after",
    ]);
  });

  it("misses half the slots: every shot still on time", () => {
    // The accepted trade: a miss is an empty slot, not lateness. You did not
    // take that one late — you did not take it.
    expect(history([0, 14, 28, 42].map(day))).toEqual([
      "on time",
      "on time",
      "on time",
      "on time",
    ]);
  });

  it("only the first shot is off: nothing after it is marked", () => {
    // The scenario that killed every chained design.
    expect(history([-1, 7, 14, 21, 28].map(day))).toEqual([
      "1 before",
      "on time",
      "on time",
      "on time",
      "on time",
    ]);
  });

  it("chaotic — late, early, a skip, then back on: each judged alone", () => {
    expect(history([0, 10, 13, 35, 42].map(day))).toEqual([
      "on time",
      "3 after",
      "1 before",
      "on time",
      "on time",
    ]);
  });

  it("always FOUR days late: reads as 3 before, the known sign inversion", () => {
    // Past the midpoint the sign flips, because the shot really is nearer next
    // week's slot than last week's. Not a bug to fix in the maths — their shot
    // day is wrong, and this is the only vocabulary the data has to say so.
    // Pinned so the limitation cannot be "fixed" by accident.
    expect(history([4, 11, 18, 25].map(day))).toEqual([
      "3 before",
      "3 before",
      "3 before",
      "3 before",
    ]);
  });
});

describe("scheduleMode", () => {
  it("answers 'did I hit my day' only with a weekly rhythm AND a shot day", () => {
    expect(scheduleMode("wednesday", 7)).toBe("grid");
    expect(scheduleMode("wednesday", 14)).toBe("grid");
    expect(scheduleMode("wednesday", 28)).toBe("grid");
  });

  it("answers 'was my gap right' for any cadence a weekday cannot describe", () => {
    // Shot day is irrelevant here, set or not — the grid would walk across the
    // week, so the weekday means nothing. The UI greys the control out to say so.
    expect(scheduleMode(undefined, 10)).toBe("rolling");
    expect(scheduleMode("wednesday", 10)).toBe("rolling");
    expect(scheduleMode("wednesday", 3)).toBe("rolling");
  });

  it("answers nothing for a weekly rhythm with no shot day", () => {
    // Deliberate, not an oversight. Rolling would work mechanically and would
    // under-report: someone consistently on Fridays who meant Wednesdays reads
    // "on time" every week. True, and useless.
    expect(scheduleMode(undefined, 7)).toBe("none");
    expect(scheduleMode(undefined, 14)).toBe("none");
  });

  it("answers nothing without a usable interval", () => {
    expect(scheduleMode("wednesday", undefined)).toBe("none");
    expect(scheduleMode("wednesday", 0)).toBe("none");
    expect(scheduleMode("wednesday", 7.5)).toBe("none");
    expect(scheduleMode("wednesday", 400)).toBe("none");
  });
});

describe("plannedDateRolling", () => {
  const gaps = (actuals: string[], interval: number) =>
    actuals.map((a, i) => {
      const planned = plannedDateRolling(actuals[i - 1], interval);
      if (!planned) return "first shot";
      const delta = daysFromPlanned({ date: a, plannedFor: planned })!;
      return delta === 0
        ? "on time"
        : delta > 0
          ? `${delta} after`
          : `${-delta} before`;
    });

  it("has no planned date for the first shot", () => {
    expect(plannedDateRolling(undefined, 10)).toBeUndefined();
  });

  it("reads a steady rhythm as on time", () => {
    expect(gaps([day(0), day(10), day(20), day(30)], 10)).toEqual([
      "first shot",
      "on time",
      "on time",
      "on time",
    ]);
  });

  it("shows a consistently long gap every time, rather than absorbing it", () => {
    expect(gaps([day(0), day(12), day(24), day(36)], 10)).toEqual([
      "first shot",
      "2 after",
      "2 after",
      "2 after",
    ]);
  });

  it("does not cascade: one late shot, then back on rhythm", () => {
    // The property that makes chaining safe HERE, where it was not safe for the
    // grid: this measures the gap, so a late shot moves the next expectation by
    // exactly the amount it should.
    expect(gaps([day(0), day(13), day(23), day(33)], 10)).toEqual([
      "first shot",
      "3 after",
      "on time",
      "on time",
    ]);
  });

  it("marks a skipped cycle once, then recovers", () => {
    expect(gaps([day(0), day(10), day(30), day(40)], 10)).toEqual([
      "first shot",
      "on time",
      "10 after",
      "on time",
    ]);
  });

  it("refuses an interval it cannot use", () => {
    expect(plannedDateRolling(day(0), 0)).toBeUndefined();
    expect(plannedDateRolling(day(0), 7.5)).toBeUndefined();
    expect(plannedDateRolling("nope", 10)).toBeUndefined();
  });
});

describe("planShot — the one entry point", () => {
  const grid = { shotDay: "wednesday" as const, intervalDays: 7 };

  it("answers nothing when the settings answer no question", () => {
    expect(planShot({ date: WED, profile: {} })).toEqual({});
    expect(planShot({ date: WED, profile: { intervalDays: 7 } })).toEqual({});
    expect(planShot({ date: WED, profile: { shotDay: "wednesday" } })).toEqual(
      {},
    );
  });

  it("establishes a grid anchor once, and hands it back to be persisted", () => {
    expect(planShot({ date: day(-1), profile: grid })).toEqual({
      plannedFor: WED,
      anchorToPersist: WED,
    });
  });

  it("uses a frozen anchor without re-establishing one", () => {
    expect(
      planShot({
        date: day(8),
        profile: { ...grid, scheduleAnchor: WED },
      }),
    ).toEqual({ plannedFor: day(7) });
  });

  it("STOPS using a frozen grid anchor the moment the interval leaves weeks", () => {
    // The bug this function exists to make unreachable. The weekly-multiple
    // guard lived only in establishAnchor, which runs once — so a user who set
    // 7 days, logged shots, then switched to 10 kept a weekday-snapped anchor
    // that described nothing, and every shot read "3 days before" forever.
    const anchor = establishAnchor("2026-08-09", "wednesday", 7)!;
    const rolling = planShot({
      date: "2026-08-19",
      previousShotDate: "2026-08-09",
      profile: {
        shotDay: "wednesday",
        intervalDays: 10,
        scheduleAnchor: anchor,
      },
    });
    // Rolling: one interval on from the previous shot, not the stale grid.
    expect(rolling).toEqual({ plannedFor: "2026-08-19" });
    expect(
      daysFromPlanned({ date: "2026-08-19", plannedFor: rolling.plannedFor }),
    ).toBe(0);
  });

  it("uses the previous shot for a rolling cadence, and nothing for the first", () => {
    const profile = { intervalDays: 10 };
    expect(planShot({ date: day(10), previousShotDate: WED, profile })).toEqual(
      {
        plannedFor: day(10),
      },
    );
    expect(planShot({ date: WED, profile })).toEqual({
      plannedFor: undefined,
    });
  });

  it("anchors the grid on the EARLIEST shot, not the one being saved", () => {
    expect(
      planShot({
        date: day(7),
        earliestShotDate: day(-1),
        profile: grid,
      }),
    ).toEqual({ plannedFor: day(7), anchorToPersist: WED });
  });
});

describe("daysFromPlanned", () => {
  it("is null when the shot has no planned date", () => {
    expect(daysFromPlanned({ date: WED })).toBeNull();
  });

  it("signs the difference: positive after, negative before", () => {
    expect(daysFromPlanned({ date: day(2), plannedFor: WED })).toBe(2);
    expect(daysFromPlanned({ date: day(-2), plannedFor: WED })).toBe(-2);
    expect(daysFromPlanned({ date: WED, plannedFor: WED })).toBe(0);
  });

  it("is null rather than NaN for an unparseable pair", () => {
    expect(daysFromPlanned({ date: "nope", plannedFor: WED })).toBeNull();
  });
});

describe("previousShotDateBefore", () => {
  it("treats a shot on the SAME day as the one before this one", () => {
    // `>=` skipped it and reached past to the shot before that, freezing a
    // planned date measured from the wrong reference. Two entries on one day is
    // a plausible mis-log, and the value is frozen — only a hand edit repairs it.
    expect(
      previousShotDateBefore("2026-08-12", [
        { id: "old", date: "2026-08-05" },
        { id: "same", date: "2026-08-12" },
      ]),
    ).toBe("2026-08-12");
  });

  it("never lets the shot being edited be its own predecessor", () => {
    expect(
      previousShotDateBefore(
        "2026-08-12",
        [
          { id: "old", date: "2026-08-05" },
          { id: "self", date: "2026-08-12" },
        ],
        "self",
      ),
    ).toBe("2026-08-05");
  });

  it("ignores anything after the shot being saved", () => {
    expect(
      previousShotDateBefore("2026-08-12", [
        { id: "later", date: "2026-08-19" },
        { id: "earlier", date: "2026-08-05" },
      ]),
    ).toBe("2026-08-05");
  });

  it("is undefined for the first shot on record", () => {
    expect(previousShotDateBefore("2026-08-12", [])).toBeUndefined();
  });
});
