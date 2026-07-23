import { describe, it, expect } from "vitest";
import {
  pickShotFields,
  pickProfileFields,
  hasProfileData,
} from "../backupDto";
import type { ShotEntry } from "../../types/shot";
import type { Profile } from "../../types/profile";

describe("pickShotFields", () => {
  it("keeps every known field that is present", () => {
    const full: ShotEntry = {
      id: "s1",
      date: "2026-07-12",
      time: "08:30",
      doseMg: 50,
      injectionSite: "thigh",
      injectionSitePosition: "left",
      testosteroneEster: "cypionate",
      carrierOil: "sesame",
      painScore: 4,
      mood: "okay",
      notes: "n",
    };
    expect(pickShotFields(full)).toEqual(full);
  });

  it("drops unknown keys (allowlist)", () => {
    const dirty = {
      id: "s1",
      date: "2026-07-12",
      evil: "smuggled",
    } as unknown as ShotEntry;
    expect(pickShotFields(dirty)).toEqual({ id: "s1", date: "2026-07-12" });
  });

  it("drops blank / whitespace-only string fields", () => {
    const dirty = {
      id: "s1",
      date: "2026-07-12",
      injectionSite: "",
      mood: "   ",
      notes: "\t",
    } as unknown as ShotEntry;
    expect(pickShotFields(dirty)).toEqual({ id: "s1", date: "2026-07-12" });
  });

  it("preserves a legitimate 0 for numeric fields (not treated as blank)", () => {
    const shot: ShotEntry = { id: "s1", date: "2026-07-12", doseMg: 0, painScore: 0 };
    expect(pickShotFields(shot)).toEqual({
      id: "s1",
      date: "2026-07-12",
      doseMg: 0,
      painScore: 0,
    });
  });

  it("returns a plain object with no carried-over prototype", () => {
    const shot: ShotEntry = { id: "s1", date: "2026-07-12" };
    expect(Object.getPrototypeOf(pickShotFields(shot))).toBe(Object.prototype);
  });
});

describe("pickProfileFields", () => {
  it("keeps known non-blank fields", () => {
    expect(
      pickProfileFields({ startDate: "2025-01-15", preferredName: "Lou" })
    ).toEqual({ startDate: "2025-01-15", preferredName: "Lou" });
  });

  it("drops unknown keys", () => {
    const dirty = {
      preferredName: "Lou",
      theme: "dark",
    } as unknown as Profile;
    expect(pickProfileFields(dirty)).toEqual({ preferredName: "Lou" });
  });

  it("drops blank / whitespace-only fields", () => {
    const dirty = {
      startDate: "   ",
      preferredName: "",
    } as unknown as Profile;
    expect(pickProfileFields(dirty)).toEqual({});
  });

  it("keeps internal spaces in a name (only the blank test trims)", () => {
    expect(pickProfileFields({ preferredName: "Lou Smith" })).toEqual({
      preferredName: "Lou Smith",
    });
  });
});

describe("hasProfileData", () => {
  it("is true when a known non-blank field is present", () => {
    expect(hasProfileData({ preferredName: "Lou" })).toBe(true);
    expect(hasProfileData({ startDate: "2025-01-15" })).toBe(true);
  });

  it("is false for an empty profile", () => {
    expect(hasProfileData({})).toBe(false);
  });

  it("is false when the only field is blank", () => {
    expect(hasProfileData({ preferredName: "  " } as Profile)).toBe(false);
  });
});
