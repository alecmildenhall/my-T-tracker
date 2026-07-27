import { describe, it, expect } from "vitest";
import { WEEKDAYS, isWeekday, weekdayOf, weekdayLabel } from "../weekday";

describe("WEEKDAYS", () => {
  it("is indexed to match Date.getDay() (0 = Sunday)", () => {
    expect(WEEKDAYS[0]).toBe("sunday");
    expect(WEEKDAYS[6]).toBe("saturday");
    expect(WEEKDAYS).toHaveLength(7);
  });
});

describe("isWeekday", () => {
  it("accepts the seven weekday keys", () => {
    for (const day of WEEKDAYS) expect(isWeekday(day)).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isWeekday("Monday")).toBe(false); // case-sensitive
    expect(isWeekday("")).toBe(false);
    expect(isWeekday("someday")).toBe(false);
    expect(isWeekday(undefined)).toBe(false);
    expect(isWeekday(3)).toBe(false);
    expect(isWeekday(null)).toBe(false);
  });
});

describe("weekdayOf", () => {
  it("returns the civil date's weekday", () => {
    // 2025-01-15 is a Wednesday.
    expect(weekdayOf("2025-01-15")).toBe("wednesday");
    // 2026-07-26 is a Sunday.
    expect(weekdayOf("2026-07-26")).toBe("sunday");
  });

  it("is stable across a spring-forward DST boundary (uses local components)", () => {
    // US DST began 2025-03-09 (a Sunday); the day before is Saturday.
    expect(weekdayOf("2025-03-08")).toBe("saturday");
    expect(weekdayOf("2025-03-09")).toBe("sunday");
  });

  it("returns null for a malformed or impossible date", () => {
    expect(weekdayOf("2025-1-5")).toBeNull();
    expect(weekdayOf("2026-13-40")).toBeNull();
    expect(weekdayOf("nope")).toBeNull();
  });
});

describe("weekdayLabel", () => {
  it("title-cases the key", () => {
    expect(weekdayLabel("wednesday")).toBe("Wednesday");
    expect(weekdayLabel("sunday")).toBe("Sunday");
  });
});
