import { describe, it, expect, afterEach, vi } from "vitest";
import { newId } from "../id";

afterEach(() => vi.restoreAllMocks());

describe("newId", () => {
  it("returns a UUID from crypto.randomUUID when available", () => {
    const id = newId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it("falls back to a timestamped id with a random suffix when randomUUID is missing", () => {
    // Simulate a non-secure context where crypto.randomUUID is unavailable.
    vi.stubGlobal("crypto", {});
    const id = newId();
    expect(id).toMatch(/^shot-\d+-[a-z0-9]+$/);
  });

  it("fallback ids in the same millisecond differ thanks to the random suffix", () => {
    vi.stubGlobal("crypto", {});
    // Freeze time so Date.now() is identical for both calls; the suffix is the
    // only thing keeping them apart. Mock Math.random to distinct values so the
    // test is deterministic (not relying on real entropy).
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T00:00:00Z"));
    const randoms = [0.123456, 0.654321];
    vi.spyOn(Math, "random").mockImplementation(() => randoms.shift() ?? 0.5);
    try {
      const a = newId();
      const b = newId();
      expect(a).not.toBe(b);
      expect(a).toMatch(/^shot-\d+-[a-z0-9]+$/);
    } finally {
      vi.useRealTimers();
    }
  });

  // Regression guard for test isolation: this runs AFTER the tests that
  // vi.stubGlobal("crypto", {}). vi.restoreAllMocks() does NOT undo stubGlobal,
  // so without `unstubGlobals: true` in vitest.config.ts the stubbed empty
  // crypto would leak here and newId() would fall back — failing this UUID
  // assertion. It passing proves the stub is restored between tests.
  it("still returns a real UUID after a prior test stubbed out crypto", () => {
    const id = newId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });
});
