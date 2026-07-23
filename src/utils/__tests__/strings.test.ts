import { describe, it, expect } from "vitest";
import { isBlank, nonBlankString } from "../strings";

describe("isBlank", () => {
  it("is true for empty and whitespace-only strings", () => {
    expect(isBlank("")).toBe(true);
    expect(isBlank("   ")).toBe(true);
    expect(isBlank("\t\n")).toBe(true);
  });

  it("is true for non-strings", () => {
    expect(isBlank(undefined)).toBe(true);
    expect(isBlank(null)).toBe(true);
    expect(isBlank(42)).toBe(true);
    expect(isBlank({})).toBe(true);
  });

  it("is false for a string with visible characters", () => {
    expect(isBlank("Lou")).toBe(false);
    expect(isBlank("  Lou  ")).toBe(false); // padded but non-blank
    expect(isBlank("0")).toBe(false);
  });
});

describe("nonBlankString", () => {
  it("returns undefined for blank or non-string input", () => {
    expect(nonBlankString("")).toBeUndefined();
    expect(nonBlankString("   ")).toBeUndefined();
    expect(nonBlankString(undefined)).toBeUndefined();
    expect(nonBlankString(123)).toBeUndefined();
  });

  it("returns the string as-is when non-blank (does not trim the value)", () => {
    expect(nonBlankString("Lou")).toBe("Lou");
    expect(nonBlankString("Lou Smith")).toBe("Lou Smith");
    // Only the blank test trims; a non-blank padded value is returned untouched.
    expect(nonBlankString("  Lou  ")).toBe("  Lou  ");
  });
});
