import { describe, it, expect } from "vitest";
import {
  addDaysCivil,
  scheduleAnchor,
  plannedDateFor,
  plannedDateOnSave,
  daysFromPlanned,
} from "../schedule";

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
  const anchor = scheduleAnchor(actuals, shotDay)!;
  return actuals.map((actual) => {
    const planned = plannedDateFor(actual, anchor, interval);
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
});

describe("scheduleAnchor", () => {
  it("snaps the earliest shot to the nearest shot day", () => {
    // A first shot taken one day early still anchors the grid to Wednesday —
    // which is the entire reason shot day is required.
    expect(scheduleAnchor([day(-1)], "wednesday")).toBe(WED);
    expect(scheduleAnchor([day(1)], "wednesday")).toBe(WED);
    expect(scheduleAnchor([WED], "wednesday")).toBe(WED);
  });

  it("picks the nearer occurrence when a shot sits between two", () => {
    // Sunday is 4 days after one Wednesday and 3 before the next.
    expect(scheduleAnchor([day(4)], "wednesday")).toBe(day(7));
  });

  it("anchors to the EARLIEST shot, whatever order they arrive in", () => {
    expect(scheduleAnchor([day(21), day(7), WED], "wednesday")).toBe(WED);
  });

  it("is null with no shots to anchor to", () => {
    expect(scheduleAnchor([], "wednesday")).toBeNull();
  });
});

describe("plannedDateFor", () => {
  it("claims the nearest slot", () => {
    expect(plannedDateFor(WED, WED, 7)).toBe(WED);
    expect(plannedDateFor(day(8), WED, 7)).toBe(day(7));
    expect(plannedDateFor(day(13), WED, 7)).toBe(day(14));
  });

  it("resolves an exact midpoint the same way on both sides of the anchor", () => {
    // Math.round rounds half AWAY FROM ZERO, so -3.5 would go to -4 while 3.5
    // goes to 4 — two shots equally spaced either side of the anchor landing on
    // slots a full interval apart. floor(x + 0.5) always rounds up.
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

describe("plannedDateOnSave", () => {
  it("needs both settings, and guesses nothing without them", () => {
    expect(plannedDateOnSave(WED, [], undefined, 7)).toBeUndefined();
    expect(plannedDateOnSave(WED, [], "wednesday", undefined)).toBeUndefined();
    expect(plannedDateOnSave(WED, [], undefined, undefined)).toBeUndefined();
  });

  it("refuses a nonsensical interval rather than dividing by it", () => {
    expect(plannedDateOnSave(WED, [], "wednesday", 0)).toBeUndefined();
    expect(plannedDateOnSave(WED, [], "wednesday", -7)).toBeUndefined();
  });

  it("anchors a first shot to itself, snapped", () => {
    expect(plannedDateOnSave(day(-1), [], "wednesday", 7)).toBe(WED);
  });

  it("anchors a later shot to the earliest one already logged", () => {
    expect(plannedDateOnSave(day(8), [day(-1)], "wednesday", 7)).toBe(day(7));
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
