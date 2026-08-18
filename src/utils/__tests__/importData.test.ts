import { describe, it, expect } from "vitest";
import { parseBackup } from "../importData";
import { toJson } from "../exportData";
import { APP_NAME, FORMAT_VERSION } from "../../appMeta";
import type { ShotEntry } from "../../types/shot";

let counter = 0;
const shot = (over: Partial<ShotEntry>): ShotEntry => ({
  id: `shot-${counter++}`,
  date: "2026-07-12",
  ...over,
});

const wrap = (shots: unknown) =>
  JSON.stringify({
    app: APP_NAME,
    formatVersion: FORMAT_VERSION,
    appVersion: "0.0.0",
    exportedAt: new Date().toISOString(),
    shots,
  });

describe("parseBackup — happy path", () => {
  it("round-trips a real export", () => {
    const shots = [
      shot({ doseMg: 50, injectionSite: "thigh", painScore: 3 }),
      shot({ date: "2026-07-05", mood: "good", notes: "fine" }),
    ];
    const result = parseBackup(toJson(shots));
    expect(result.ok).toBe(true);
    if (result.ok) {
      // export sorts chronologically; compare as sets by id
      expect(result.shots).toHaveLength(2);
      expect(result.shots.map((s) => s.id).sort()).toEqual(
        shots.map((s) => s.id).sort()
      );
    }
  });

  it("preserves every optional field that was present", () => {
    const full = shot({
      time: "08:30",
      doseMg: 50,
      injectionSite: "thigh",
      injectionSitePosition: "left",
      testosteroneEster: "cypionate",
      carrierOil: "sesame",
      painScore: 4,
      mood: "okay",
      notes: "n",
    });
    const result = parseBackup(toJson([full]));
    expect(result.ok && result.shots[0]).toEqual(full);
  });

  it("omits absent optional fields rather than setting them undefined explicitly", () => {
    const result = parseBackup(toJson([shot({})]));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.shots[0]).sort()).toEqual(["date", "id"]);
    }
  });
});

describe("parseBackup — profile", () => {
  it("round-trips a profile carried in the backup", () => {
    const json = toJson([shot({})], {
      startDate: "2025-01-15",
      preferredName: "Lou",
    });
    const result = parseBackup(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.profile).toEqual({
        startDate: "2025-01-15",
        preferredName: "Lou",
      });
    }
  });

  it("returns an empty profile when the backup has none (older file)", () => {
    const result = parseBackup(toJson([shot({})]));
    expect(result.ok && result.profile).toEqual({});
  });

  it("allowlists profile fields — an unknown key is not accepted", () => {
    // A smuggled key still gets nowhere. What changed is the blast radius: the
    // profile is refused, not the whole file, and the caller is told so it can
    // keep the profile this device already holds.
    const result = parseBackup(
      JSON.stringify({
        ...JSON.parse(wrap([])),
        profile: { preferredName: "Lou", secret: "smuggled" },
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profileUnreadable).toBe(true);
    expect(result.profile).toEqual({});
  });

  it("does not accept a malformed start date in the profile", () => {
    const result = parseBackup(
      JSON.stringify({
        ...JSON.parse(wrap([])),
        profile: { startDate: "01/15/2025" },
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profileUnreadable).toBe(true);
    expect(result.profile.startDate).toBeUndefined();
  });

  it("does not accept an empty-string preferred name in the profile", () => {
    const result = parseBackup(
      JSON.stringify({
        ...JSON.parse(wrap([])),
        profile: { preferredName: "" },
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profileUnreadable).toBe(true);
  });

  it("accepts a start date however far off, so long as it is a real date", () => {
    // Import must accept whatever the app itself let someone set, or a profile
    // fails to re-import the very date it stored. The field is unbounded on
    // purpose (see JourneySettings), so this boundary is too.
    for (const startDate of ["2999-01-01", "1901-06-30"]) {
      const result = parseBackup(
        JSON.stringify({ ...JSON.parse(wrap([])), profile: { startDate } })
      );
      expect(result.ok).toBe(true);
    }
  });

  it("does not accept a start date that is not a real date", () => {
    const result = parseBackup(
      JSON.stringify({
        ...JSON.parse(wrap([])),
        profile: { startDate: "2025-02-30" },
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profileUnreadable).toBe(true);
  });

  it("refuses a file whose every shot is dated outside the supported range", () => {
    // One bad row among good ones is skipped (see below); a file with nothing
    // BUT bad rows has nothing to restore, so it is refused and changes nothing.
    const result = parseBackup(wrap([{ id: "a", date: "9999-01-01" }]));
    expect(result.ok).toBe(false);
  });

  it("accepts a valid shot day and rejects a bogus one", () => {
    const ok = parseBackup(
      JSON.stringify({
        ...JSON.parse(wrap([])),
        profile: { shotDay: "wednesday" },
      })
    );
    expect(ok.ok).toBe(true);
    const bad = parseBackup(
      JSON.stringify({
        ...JSON.parse(wrap([])),
        profile: { shotDay: "someday" },
      })
    );
    expect(bad.ok).toBe(true);
    if (!bad.ok) return;
    expect(bad.profileUnreadable).toBe(true);
    expect(bad.profile.shotDay).toBeUndefined();
  });

  it("accepts a past start date", () => {
    const result = parseBackup(
      JSON.stringify({
        ...JSON.parse(wrap([])),
        profile: { startDate: "2000-01-01" },
      })
    );
    expect(result.ok).toBe(true);
  });
});

describe("parseBackup — malformed input", () => {
  const expectRejected = (text: string) => {
    const result = parseBackup(text);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Error is generic — never leaks parser/schema internals.
      expect(result.error).toMatch(/couldn.t be read/i);
    }
  };

  it("rejects the empty string", () => expectRejected(""));
  it("rejects non-JSON text", () => expectRejected("not json {"));
  it("rejects a bare array (no envelope)", () =>
    expectRejected(JSON.stringify([shot({})])));
  it("rejects an envelope from another app", () =>
    expectRejected(
      JSON.stringify({ ...JSON.parse(wrap([])), app: "some-other-app" })
    ));
  it("rejects an unknown formatVersion", () =>
    expectRejected(
      JSON.stringify({ ...JSON.parse(wrap([])), formatVersion: 999 })
    ));
  // Entry-level problems are NOT file-level ones, so these live below. A file
  // whose only entry is unusable still refuses — there is nothing to restore —
  // but it says so in its own words rather than blaming the file's origin.
  it("rejects a file whose only entry is unusable", () => {
    const result = parseBackup(wrap([{ id: "x", date: "nope" }]));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/none of the 1 entry/i);
      // NOT the wrong-file message: this IS a T-Shot Tracker backup, and
      // telling someone to go and find a file they already have is a dead end.
      expect(result.error).not.toMatch(/exported from this app/i);
    }
  });
});

describe("parseBackup — a bad entry is skipped, not the file", () => {
  const skipOne = (bad: unknown) =>
    parseBackup(wrap([{ id: "keep", date: "2026-07-12" }, bad]));

  it.each([
    ["no date at all", { id: "x" }],
    ["a bad date format", { id: "x", date: "07/12/2026" }],
    ["an impossible calendar date", { id: "x", date: "2026-13-40" }],
    ["a non-existent day (Feb 30)", { id: "x", date: "2026-02-30" }],
    ["a date outside the supported range", { id: "x", date: "9999-01-01" }],
    ["an out-of-range time", { id: "x", date: "2026-07-12", time: "24:99" }],
    ["an out-of-range painScore", { id: "x", date: "2026-07-12", painScore: 99 }],
    ["an unexpected extra key", { id: "x", date: "2026-07-12", evil: "surprise" }],
    ["an empty-string optional field", { id: "x", date: "2026-07-12", mood: "" }],
  ])("restores the good entry and skips one with %s", (_label, bad) => {
    const result = skipOne(bad);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.shots.map((s) => s.id)).toEqual(["keep"]);
    expect(result.total).toBe(2);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].position).toBe(2);
    expect(result.skipped[0].reason).toBeTruthy();
  });

  it("names the entry by the date the user typed, when that is readable", () => {
    const result = skipOne({ id: "x", date: "9999-01-01" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.skipped[0].date).toBe("9999-01-01");
    expect(result.skipped[0].reason).toMatch(/date/i);
  });

  it("carries no date when the date is the unreadable part", () => {
    // Then the caller has to name it by position instead — there is nothing
    // else about the entry a person would recognise.
    const result = skipOne({ id: "x" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.skipped[0].date).toBeUndefined();
  });

  it("reports no skips at all for a clean file", () => {
    const result = parseBackup(wrap([{ id: "a", date: "2026-07-12" }]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.skipped).toEqual([]);
    expect(result.total).toBe(1);
    expect(result.profileUnreadable).toBe(false);
  });
});

describe("parseBackup — an unreadable profile keeps the device's own", () => {
  it("restores the shots and flags the profile rather than clearing it", () => {
    // A profile is ONE object: there is no "43 of 44" to salvage, and replacing
    // it with {} would clear a name and shot day this device already holds in
    // exchange for nothing.
    const result = parseBackup(
      JSON.stringify({
        ...JSON.parse(wrap([{ id: "a", date: "2026-07-12" }])),
        profile: { startDate: "not-a-date" },
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.shots).toHaveLength(1);
    expect(result.profileUnreadable).toBe(true);
    expect(result.profile).toEqual({});
  });

  it("does not flag a file that simply has no profile", () => {
    const result = parseBackup(wrap([{ id: "a", date: "2026-07-12" }]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profileUnreadable).toBe(false);
  });
});

describe("parseBackup — prototype pollution", () => {
  it("rejects a payload containing a __proto__ key", () => {
    const malicious =
      '{"app":"' +
      APP_NAME +
      '","formatVersion":1,"appVersion":"0.0.0","exportedAt":"x","shots":[],"__proto__":{"polluted":true}}';
    const result = parseBackup(malicious);
    expect(result.ok).toBe(false);
    // and no pollution happened
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("rejects a __proto__ nested inside a shot", () => {
    const malicious =
      '{"app":"' +
      APP_NAME +
      '","formatVersion":1,"appVersion":"0.0.0","exportedAt":"x","shots":[{"id":"x","date":"2026-07-12","__proto__":{"polluted":true}}]}';
    const result = parseBackup(malicious);
    expect(result.ok).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("does not carry a prototype onto returned shots", () => {
    const result = parseBackup(toJson([shot({ doseMg: 50 })]));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.getPrototypeOf(result.shots[0])).toBe(Object.prototype);
    }
  });
});

describe("parseBackup — size cap", () => {
  it("rejects input larger than the cap without throwing", () => {
    const huge = "x".repeat(10 * 1024 * 1024 + 1);
    const result = parseBackup(huge);
    expect(result.ok).toBe(false);
  });

  it("accepts a realistically large backup (5 years weekly, fully filled)", () => {
    const shots: ShotEntry[] = [];
    for (let i = 0; i < 260; i++) {
      shots.push(
        shot({
          time: "08:30",
          doseMg: 50,
          injectionSite: "thigh",
          injectionSitePosition: "left",
          testosteroneEster: "cypionate",
          carrierOil: "sesame",
          painScore: 3,
          mood: "okay",
          notes: "a fairly typical note about how the shot felt today",
        })
      );
    }
    const json = toJson(shots);
    expect(json.length).toBeLessThan(10 * 1024 * 1024);
    const result = parseBackup(json);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.shots).toHaveLength(260);
  });
});
