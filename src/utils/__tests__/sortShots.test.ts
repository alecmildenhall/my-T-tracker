import { describe, it, expect } from "vitest";
import { compareShotsChrono } from "../sortShots";
import type { ShotEntry } from "../../types/shot";

const shot = (over: Partial<ShotEntry>): ShotEntry => ({
  id: "x",
  date: "2026-07-14",
  ...over,
});

describe("compareShotsChrono", () => {
  it("orders by date ascending", () => {
    expect(
      compareShotsChrono(shot({ date: "2026-07-13" }), shot({ date: "2026-07-14" }))
    ).toBeLessThan(0);
  });

  it("orders same-day shots by time, not by id", () => {
    // Morning shot has an id that sorts AFTER the evening shot's id — the old
    // list sort would have put it first. Time must win.
    const morning = shot({ id: "zzz", time: "08:00" });
    const evening = shot({ id: "aaa", time: "20:00" });
    expect(compareShotsChrono(morning, evening)).toBeLessThan(0);

    const ascending = [evening, morning].sort(compareShotsChrono);
    expect(ascending.map((s) => s.time)).toEqual(["08:00", "20:00"]);
    // Newest-first (list order) is the negation.
    const newestFirst = [morning, evening].sort((a, b) => -compareShotsChrono(a, b));
    expect(newestFirst.map((s) => s.time)).toEqual(["20:00", "08:00"]);
  });

  it("treats a missing time as 00:00", () => {
    const noTime = shot({ id: "a", time: undefined });
    const withTime = shot({ id: "b", time: "09:00" });
    expect(compareShotsChrono(noTime, withTime)).toBeLessThan(0);
  });

  it("breaks exact ties deterministically by id", () => {
    const a = shot({ id: "a", time: "10:00" });
    const b = shot({ id: "b", time: "10:00" });
    expect(compareShotsChrono(a, b)).toBeLessThan(0);
    expect(compareShotsChrono(b, a)).toBeGreaterThan(0);
    expect(compareShotsChrono(a, a)).toBe(0);
  });
});
