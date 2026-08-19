import { describe, it, expect, afterEach, vi } from "vitest";
import { localISODate, todayLocalISO, nowHHMM, formatTimeForDisplay } from "../datetime";

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

  it("localISODate throws on an Invalid Date rather than branding NaN-NaN-NaN", () => {
    // Branding an Invalid Date would mint a CivilDate the type system trusts as
    // a real date — the guarantee the brand exists to uphold. Fail loud instead.
    expect(() => localISODate(new Date("garbage"))).toThrow(RangeError);
  });

  it("nowHHMM formats local wall-clock time, zero-padded", () => {
    expect(nowHHMM(new Date("2026-07-14T09:05:00"))).toBe("09:05");
    expect(nowHHMM(new Date("2026-07-14T14:40:00"))).toBe("14:40");
  });
});

describe("formatTimeForDisplay", () => {
  it("renders a stored 24-hour time the way the locale writes it", () => {
    // The test runner's locale decides which; what matters is that it goes
    // through Intl rather than being hand-formatted, so a device that writes
    // 15:45 keeps writing 15:45 and one that writes 3:45 PM gets that.
    const rendered = formatTimeForDisplay("15:45");
    const expected = new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(2000, 0, 1, 15, 45));
    expect(rendered).toBe(expected);
  });

  it("keeps midnight and noon distinct", () => {
    expect(formatTimeForDisplay("00:00")).not.toBe(formatTimeForDisplay("12:00"));
  });

  it("hands back anything it cannot read, rather than inventing a time", () => {
    // Storage is untrusted: a hand-edited or older value must show as itself
    // instead of being coerced into a plausible-looking wrong one.
    for (const raw of ["", "nope", "7:5", "25:00", "12:99", "08:30:00"]) {
      expect(formatTimeForDisplay(raw)).toBe(raw);
    }
  });

  it("does not shift the hour across timezones or DST", () => {
    // Asserted against Intl rather than against the string "12", which assumed a
    // 12-hour locale: on en-GB this rendered "0:00" and the suite went red for
    // any contributor whose ICU default is not US-style. The claim worth making
    // is that the hour survives the round trip, not which clock writes it.
    const midnight = new Date(2000, 0, 1, 0, 0);
    expect(formatTimeForDisplay("00:00")).toBe(
      new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }).format(midnight)
    );
    // ...and the hour is genuinely the one asked for, in any locale.
    expect(midnight.getHours()).toBe(0);
  });
});
