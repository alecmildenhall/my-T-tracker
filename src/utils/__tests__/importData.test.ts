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

  it("allowlists profile fields — an unknown key is rejected", () => {
    const result = parseBackup(
      JSON.stringify({
        ...JSON.parse(wrap([])),
        profile: { preferredName: "Lou", secret: "smuggled" },
      })
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a malformed start date in the profile", () => {
    const result = parseBackup(
      JSON.stringify({
        ...JSON.parse(wrap([])),
        profile: { startDate: "01/15/2025" },
      })
    );
    expect(result.ok).toBe(false);
  });

  it("rejects an empty-string preferred name in the profile", () => {
    const result = parseBackup(
      JSON.stringify({
        ...JSON.parse(wrap([])),
        profile: { preferredName: "" },
      })
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a start date in the future (mirrors the UI's today cap)", () => {
    const result = parseBackup(
      JSON.stringify({
        ...JSON.parse(wrap([])),
        profile: { startDate: "2999-01-01" },
      })
    );
    expect(result.ok).toBe(false);
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
  it("rejects a shot missing its required date", () =>
    expectRejected(wrap([{ id: "x" }])));
  it("rejects a bad date format", () =>
    expectRejected(wrap([{ id: "x", date: "07/12/2026" }])));
  it("rejects an impossible calendar date (month/day out of range)", () =>
    expectRejected(wrap([{ id: "x", date: "2026-13-40" }])));
  it("rejects a non-existent day (Feb 30)", () =>
    expectRejected(wrap([{ id: "x", date: "2026-02-30" }])));
  it("rejects an out-of-range time", () =>
    expectRejected(wrap([{ id: "x", date: "2026-07-12", time: "24:99" }])));
  it("rejects an out-of-range painScore", () =>
    expectRejected(wrap([{ id: "x", date: "2026-07-12", painScore: 99 }])));
  it("rejects an unexpected extra key on a shot", () =>
    expectRejected(
      wrap([{ id: "x", date: "2026-07-12", evil: "surprise" }])
    ));
  it("rejects an empty-string optional field", () =>
    expectRejected(wrap([{ id: "x", date: "2026-07-12", mood: "" }])));
});

describe("parseBackup — atomicity", () => {
  it("rejects the whole file if any shot is invalid", () => {
    const result = parseBackup(
      wrap([
        { id: "ok", date: "2026-07-12" },
        { id: "bad", date: "nope" },
      ])
    );
    expect(result.ok).toBe(false);
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
