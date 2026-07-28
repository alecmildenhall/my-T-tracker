import { describe, it, expect } from "vitest";
import {
  isRealDate,
  civilDateParts,
  toCivilDate,
  unsafeCivilDate,
} from "../civilDate";

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

describe("toCivilDate", () => {
  it("returns the value unchanged (branded) for a real date", () => {
    expect(toCivilDate("2026-07-14")).toBe("2026-07-14");
    expect(toCivilDate("2024-02-29")).toBe("2024-02-29"); // leap day
    expect(toCivilDate("2099-01-01")).toBe("2099-01-01"); // future is valid
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
