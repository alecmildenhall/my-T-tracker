import { describe, it, expect } from "vitest";
import { isRealDate, civilDateParts } from "../civilDate";

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
