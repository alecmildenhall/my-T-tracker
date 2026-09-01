import { describe, it, expect } from "vitest";
import { profileSchema, shotEntrySchema } from "../shotSchema";
import { MAX_INTERVAL_DAYS } from "../../types/profile";
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
    const shot: ShotEntry = {
      id: "s1",
      date: "2026-07-12",
      doseMg: 0,
      painScore: 0,
    };
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

describe("pickShotFields — the planned date", () => {
  it("carries plannedFor through a backup", () => {
    // It did not, for one commit, in a change titled "carry the planned date
    // through every boundary". The allowlist is on BOTH the export and import
    // paths, so the omission did not fail — it silently dropped every shot's
    // timing on restore, and by design it can never be regenerated, because it
    // is frozen at save time from the settings in force then.
    expect(
      pickShotFields({
        id: "a",
        date: "2026-08-06",
        plannedFor: "2026-08-05",
      }),
    ).toEqual({ id: "a", date: "2026-08-06", plannedFor: "2026-08-05" });
  });

  it("drops a blank planned date rather than storing an empty string", () => {
    expect(
      pickShotFields({ id: "a", date: "2026-08-06", plannedFor: "  " }),
    ).toEqual({ id: "a", date: "2026-08-06" });
  });

  it("drops a planned date the importer would refuse", () => {
    for (const bad of ["9999-01-01", "1899-12-31", "nope"]) {
      expect(
        pickShotFields({ id: "a", date: "2026-08-06", plannedFor: bad }),
      ).toEqual({ id: "a", date: "2026-08-06" });
    }
  });

  it("exports a shot its own importer accepts", () => {
    const widest = pickShotFields({
      id: "a",
      date: "2026-08-06",
      plannedFor: "2026-08-05",
      notes: "n",
    });
    expect(shotEntrySchema.safeParse(widest).success).toBe(true);
  });
});

describe("pickProfileFields", () => {
  it("keeps known non-blank fields", () => {
    expect(
      pickProfileFields({ startDate: "2025-01-15", preferredName: "Lou" }),
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

  it("keeps a valid shot day and drops a bogus one", () => {
    expect(pickProfileFields({ shotDay: "wednesday" })).toEqual({
      shotDay: "wednesday",
    });
    expect(
      pickProfileFields({ shotDay: "someday" } as unknown as Profile),
    ).toEqual({});
  });

  it("carries the anchor and interval, whole and in range only", () => {
    // The allowlist trap CLAUDE.md names by name: a Profile field missing from
    // here does not fail loudly, it silently does not survive the user's own
    // backup and reverts to unset on restore — losing the schedule every
    // planned date was measured against.
    expect(pickProfileFields({ intervalDays: 14 })).toEqual({
      intervalDays: 14,
    });
    // Bounds shared with the import schema. They drifted for one commit — the
    // schema capped at 365 while this had no upper bound — which let the app
    // export a profile its own importer refused. The profile is atomic, so that
    // costs the user all of it on restore.
    for (const bad of [0, -7, 7.5, NaN, "7", 366, 100000]) {
      expect(
        pickProfileFields({ intervalDays: bad } as unknown as Profile),
      ).toEqual({});
    }
    expect(pickProfileFields({ scheduleAnchor: "2026-08-05" })).toEqual({
      scheduleAnchor: "2026-08-05",
    });
  });

  it("exports nothing its own importer would refuse", () => {
    // The claim in this file's header, asserted rather than trusted: one
    // allowlist per shape means export and the strict import schema cannot
    // drift apart.
    const widest = pickProfileFields({
      startDate: "2025-01-15",
      preferredName: "Lou",
      shotDay: "wednesday",
      intervalDays: MAX_INTERVAL_DAYS,
      scheduleAnchor: "2026-08-05",
    });
    expect(profileSchema.safeParse(widest).success).toBe(true);
  });

  it("drops an anchor the importer would refuse, rather than exporting it", () => {
    // The DTO used to accept any non-blank string while the schema required
    // isShotDateInRange, so the app could write a profile it could not read
    // back — and the profile is atomic, so that costs startDate, preferredName,
    // shotDay and intervalDays too. Reachable without hand-editing:
    // establishAnchor("1900-01-01", "sunday") returns "1899-12-31".
    for (const bad of ["9999-01-01", "1899-12-31", "not-a-date", "  ", 7]) {
      expect(
        pickProfileFields({ scheduleAnchor: bad } as unknown as Profile),
      ).toEqual({});
    }
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
