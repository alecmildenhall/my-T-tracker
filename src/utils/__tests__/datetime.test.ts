import { describe, it, expect, afterEach, vi } from "vitest";
import { localISODate, todayLocalISO, nowHHMM } from "../datetime";

afterEach(() => vi.useRealTimers());

describe("datetime helpers", () => {
  it("localISODate uses local calendar components, not UTC", () => {
    // 8pm Pacific (UTC-7 in July) is already the next day in UTC. The local
    // date must stay on the 14th — the bug this replaces returned the 15th.
    const eveningPacific = new Date("2026-07-14T20:00:00-07:00");
    // getFullYear/Month/Date are local to the test runner; assert it matches the
    // machine-local rendering of that instant rather than the UTC slice.
    const expected = `${eveningPacific.getFullYear()}-${String(
      eveningPacific.getMonth() + 1
    ).padStart(2, "0")}-${String(eveningPacific.getDate()).padStart(2, "0")}`;
    expect(localISODate(eveningPacific)).toBe(expected);
    // And it is NOT the naive UTC slice when the two differ.
    if (eveningPacific.toISOString().slice(0, 10) !== expected) {
      expect(localISODate(eveningPacific)).not.toBe(
        eveningPacific.toISOString().slice(0, 10)
      );
    }
  });

  it("todayLocalISO returns today's local date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-09T23:30:00"));
    expect(todayLocalISO()).toBe("2026-03-09");
  });

  it("localISODate zero-pads month and day", () => {
    expect(localISODate(new Date("2026-01-05T12:00:00"))).toBe("2026-01-05");
  });

  it("nowHHMM formats local wall-clock time, zero-padded", () => {
    expect(nowHHMM(new Date("2026-07-14T09:05:00"))).toBe("09:05");
    expect(nowHHMM(new Date("2026-07-14T14:40:00"))).toBe("14:40");
  });
});
