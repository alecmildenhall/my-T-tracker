import { describe, it, expect, vi } from "vitest";
import {
  isRealDate,
  civilDateParts,
  toCivilDate,
  unsafeCivilDate,
  isShotDateInRange,
  shotDateRange,
  toShotDate,
  EARLIEST_YEAR,
  FUTURE_YEAR_ALLOWANCE,
} from "../civilDate";

/** A year as a date string, padded — the same four-digit shape the range check
 *  compares against. Built raw, these stop being real dates the moment
 *  EARLIEST_YEAR drops below 1000, and the suite would then fail for its own
 *  construction rather than for anything the code did. */
const yearAsDate = (year: number, rest: string) =>
  `${String(year).padStart(4, "0")}${rest}`;

describe("isRealDate", () => {
  it("accepts real calendar dates", () => {
    expect(isRealDate("2026-07-14")).toBe(true);
    expect(isRealDate("2024-02-29")).toBe(true); // leap day
  });

  it("rejects malformed shapes", () => {
    expect(isRealDate("2026-7-4")).toBe(false);
    expect(isRealDate("07/14/2026")).toBe(false);
    expect(isRealDate("")).toBe(false);
    expect(isRealDate("2026-07-14T00:00")).toBe(false);
  });

  it("rejects shape-valid but impossible dates", () => {
    expect(isRealDate("2026-13-40")).toBe(false);
    expect(isRealDate("2026-02-30")).toBe(false);
    expect(isRealDate("2025-02-29")).toBe(false); // non-leap
    expect(isRealDate("2026-00-10")).toBe(false);
  });
});

describe("civilDateParts", () => {
  it("parses a valid date into [y, m, d]", () => {
    expect(civilDateParts("2026-07-14")).toEqual([2026, 7, 14]);
  });

  it("returns null for an impossible or malformed date", () => {
    expect(civilDateParts("2026-13-40")).toBeNull();
    expect(civilDateParts("nope")).toBeNull();
  });
});

describe("isShotDateInRange", () => {
  const shift = (years: number, days = 0) => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + years);
    d.setDate(d.getDate() + days);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  it("accepts today, the distant-but-real past, and a year ahead", () => {
    expect(isShotDateInRange(shift(0))).toBe(true);
    expect(isShotDateInRange(yearAsDate(EARLIEST_YEAR, "-01-01"))).toBe(true);
    // A year out to the day is the boundary itself, and it is inclusive.
    expect(isShotDateInRange(shift(FUTURE_YEAR_ALLOWANCE))).toBe(true);
  });

  it("rejects the mistyped years that a date input invites", () => {
    // The two that reached storage in a browser pass. `0999` is the one a
    // four-digit typo produces; `9999` is what a held-down arrow key produces.
    expect(isShotDateInRange("0999-01-01")).toBe(false);
    expect(isShotDateInRange("9999-01-01")).toBe(false);
    // And the sub-100 years, which used to be refused only by accident:
    // civilDateParts round-trips through Date.UTC, which maps 0–99 into the
    // 1900s, so the round-trip failed rather than the range.
    expect(isShotDateInRange("0008-08-05")).toBe(false);
    expect(isShotDateInRange(yearAsDate(EARLIEST_YEAR - 1, "-12-31"))).toBe(false);
  });

  it("rejects a date just past the allowance, not just wild ones", () => {
    expect(isShotDateInRange(shift(FUTURE_YEAR_ALLOWANCE, 1))).toBe(false);
    expect(isShotDateInRange(shift(FUTURE_YEAR_ALLOWANCE + 1))).toBe(false);
  });

  it("still rejects anything that is not a real calendar date", () => {
    expect(isShotDateInRange("2026-02-30")).toBe(false);
    expect(isShotDateInRange("2026-7-4")).toBe(false);
    expect(isShotDateInRange("")).toBe(false);
  });
});

describe("shotDateRange", () => {
  it("matches what isShotDateInRange accepts at both ends", () => {
    const { min, max } = shotDateRange();
    // The attributes are a picker hint, so their whole value is agreeing with
    // the check — a picker that offers a date the form then refuses is worse
    // than no picker bound at all.
    expect(isShotDateInRange(min)).toBe(true);
    expect(isShotDateInRange(max)).toBe(true);
    expect(min).toBe(yearAsDate(EARLIEST_YEAR, "-01-01"));
    // The bound is compared LEXICALLY, which is only valid while the year is
    // four digits. Lower EARLIEST_YEAR below 1000 without padding and "900-01-01"
    // sorts AFTER "1899-01-01", so every date in the app is rejected — silently,
    // with nothing else here to catch it. Pinning the width pins the invariant.
    expect(min).toHaveLength(10);
    expect(Number(max.slice(0, 4))).toBe(
      new Date().getFullYear() + FUTURE_YEAR_ALLOWANCE
    );
  });

  it("agrees with the check on a leap day, where the two used to diverge", () => {
    // On 29 February the bound rolls to 1 March of the next year, because
    // 2029-02-29 does not exist. The range published that rolled date while the
    // check compared year/month/day components and stopped at 2029-02-28 — so
    // the picker offered two days the form refused. Both now read one function.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2028, 1, 29, 12));
    try {
      const { max } = shotDateRange();
      expect(max).toBe("2029-03-01");
      expect(isShotDateInRange("2029-03-01")).toBe(true);
      expect(isShotDateInRange("2029-02-28")).toBe(true);
      // ...and one day past the bound is still out.
      expect(isShotDateInRange("2029-03-02")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("moves with the clock rather than being fixed at import time", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 11, 31, 12));
      expect(shotDateRange().max).toBe("2027-12-31");
      // A session left open across New Year must not keep last year's bound.
      vi.setSystemTime(new Date(2027, 0, 1, 12));
      expect(shotDateRange().max).toBe("2028-01-01");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("toCivilDate", () => {
  it("brands any real calendar date, with no range of its own", () => {
    expect(toCivilDate("2026-07-14")).toBe("2026-07-14");
    expect(toCivilDate("2024-02-29")).toBe("2024-02-29"); // leap day
    // Range rules are per-field, so the shared constructor does not hold one.
    // The T start date relies on this: any real date someone reports about their
    // own life is accepted. `toShotDate` is where the shot rule lives.
    expect(toCivilDate("2099-01-01")).toBe("2099-01-01");
    expect(toCivilDate("0999-01-01")).toBe("0999-01-01");
  });

  it("returns null for malformed or impossible dates", () => {
    expect(toCivilDate("2026-7-4")).toBeNull(); // not zero-padded
    expect(toCivilDate("07/14/2026")).toBeNull();
    expect(toCivilDate("")).toBeNull();
    expect(toCivilDate("2026-13-40")).toBeNull();
    expect(toCivilDate("2026-02-30")).toBeNull();
    expect(toCivilDate("2025-02-29")).toBeNull(); // non-leap
  });
});

describe("unsafeCivilDate", () => {
  it("brands without checking (trusted producers only)", () => {
    // Same string back, brand attached — no validation, so only for values
    // already known to be real dates.
    expect(unsafeCivilDate("2026-07-14")).toBe("2026-07-14");
  });
});

describe("toShotDate", () => {
  it("brands a real date inside the shot range, and refuses one outside it", () => {
    // The pair that matters: the two constructors must disagree exactly here, or
    // binding both to one rule silently applies the shot bound to the start date
    // (which is how this was first written).
    expect(toShotDate("2026-07-14")).toBe("2026-07-14");
    expect(toShotDate("0999-01-01")).toBeNull();
    expect(toShotDate("9999-01-01")).toBeNull();
    expect(toCivilDate("0999-01-01")).not.toBeNull(); // ...and it IS a real date
  });
});
