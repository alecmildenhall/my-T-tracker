import { describe, it, expect } from "vitest";
import { profileSchema, shotEntrySchema } from "../shotSchema";
import { toCsv } from "../exportData";
import { MAX_INTERVAL_DAYS } from "../../types/profile";
import {
  pickShotFields,
  pickProfileFields,
  hasProfileData,
} from "../backupDto";
import { OFF_DAYS_PATTERNS, PAIN_LEVELS, type ShotEntry } from "../../types/shot";
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
      pain: "moderate",
      offDays: "here-and-there",
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

  it("keeps a known off-days pattern and drops an unknown one", () => {
    // The DTO is an allowlist on BOTH the export and the import path, so a
    // field missing here does not fail — it silently does not survive a backup.
    // And storage is lenient, so a value predating the enum reaches this
    // function; writing it verbatim would put it back into a restored shot.
    expect(
      pickShotFields({
        id: "s1",
        date: "2026-07-12",
        offDays: "right-before",
      }),
    ).toEqual({ id: "s1", date: "2026-07-12", offDays: "right-before" });

    expect(
      pickShotFields({
        id: "s1",
        date: "2026-07-12",
        offDays: "a bit rough",
      } as unknown as ShotEntry),
    ).toEqual({ id: "s1", date: "2026-07-12" });
  });

  it("drops blank / whitespace-only string fields", () => {
    const dirty = {
      id: "s1",
      date: "2026-07-12",
      injectionSite: "",
      notes: "\t",
    } as unknown as ShotEntry;
    expect(pickShotFields(dirty)).toEqual({ id: "s1", date: "2026-07-12" });
  });

  it("preserves a legitimate 0 for numeric fields (not treated as blank)", () => {
    const shot: ShotEntry = {
      id: "s1",
      date: "2026-07-12",
      doseMg: 0,
      pain: "none",
    };
    expect(pickShotFields(shot)).toEqual({
      id: "s1",
      date: "2026-07-12",
      doseMg: 0,
      pain: "none",
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
    expect(pickProfileFields({ shotDays: ["wednesday"] })).toEqual({
      shotDays: ["wednesday"],
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
      shotDays: ["wednesday"],
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

describe("pain survives a backup round-trip", () => {
  // The check that catches a missed allowlist, which is the trap CLAUDE.md
  // names and which this codebase has fallen into before: the DTO is an
  // allowlist, and `replaceProfile`/`replaceAll` swap wholesale on import, so a
  // field the picker forgets is silently absent from the user's own backup and
  // reverts on restore. Every level, because a picker can be written to carry
  // some values and drop others (an `if (pain)` would lose nothing here, but
  // the same shape has lost a legitimate 0 elsewhere).
  it("carries every level out and back, unchanged", () => {
    for (const level of PAIN_LEVELS) {
      const shot: ShotEntry = { id: "a", date: "2026-08-05", pain: level };
      const exported = pickShotFields(shot);
      expect(exported.pain).toBe(level);

      // And the app's own importer accepts what its exporter produced — the
      // guarantee, rather than a per-field assertion that can drift from it.
      const reimported = shotEntrySchema.safeParse(exported);
      expect(reimported.success).toBe(true);
      expect(reimported.success && reimported.data.pain).toBe(level);
    }
  });

  it("carries 'no pain recorded' as absence, not as a level", () => {
    const exported = pickShotFields({ id: "a", date: "2026-08-05" });
    expect("pain" in exported).toBe(false);
    expect(shotEntrySchema.safeParse(exported).success).toBe(true);
  });

  it("refuses a level the app could never have produced", () => {
    // Import is the other way into storage, so the enum has to be enforced
    // there too — a bound at the form alone is a bound with a door beside it.
    expect(
      shotEntrySchema.safeParse({ id: "a", date: "2026-08-05", pain: "agony" })
        .success,
    ).toBe(false);
    // Including the old numeric shape, which is the accepted pre-GA cost.
    expect(
      shotEntrySchema.safeParse({ id: "a", date: "2026-08-05", pain: 7 })
        .success,
    ).toBe(false);
  });
});

describe("off days survives a backup round-trip", () => {
  // The same guarantee as pain above, stated for the new field rather than
  // assumed to come along with it — which is exactly what an allowlist does not
  // do. Every pattern, because a picker can be written to carry some values and
  // drop others.
  it("carries every pattern out and back, unchanged", () => {
    for (const pattern of OFF_DAYS_PATTERNS) {
      const shot: ShotEntry = { id: "a", date: "2026-08-05", offDays: pattern };
      const exported = pickShotFields(shot);
      expect(exported.offDays).toBe(pattern);

      const reimported = shotEntrySchema.safeParse(exported);
      expect(reimported.success).toBe(true);
      expect(reimported.success && reimported.data.offDays).toBe(pattern);
    }
  });

  it("carries 'nobody answered' as absence, not as 'none'", () => {
    // `undefined` and `"none"` are different facts, and a round-trip that
    // quietly turned the first into the second would put an answer on every
    // shot nobody answered for.
    const exported = pickShotFields({ id: "a", date: "2026-08-05" });
    expect("offDays" in exported).toBe(false);
    expect(shotEntrySchema.safeParse(exported).success).toBe(true);
  });

  it("refuses a pattern the app could never have produced", () => {
    // Import is the other way into storage, so the enum is enforced there too —
    // a bound at the form alone is a bound with a door beside it. The old
    // free-text shape is refused with it, which is the accepted pre-GA cost.
    for (const bad of ["a bit rough", "", 3, "anxious"]) {
      expect(
        shotEntrySchema.safeParse({
          id: "a",
          date: "2026-08-05",
          offDays: bad,
        }).success,
      ).toBe(false);
    }
  });

  it("is blanked in the CSV rather than shown to a provider", () => {
    // The two exports must agree: a value the backup drops must not appear
    // verbatim in the file someone prints for a clinician. Caught by mutation —
    // removing `usable` from the column broke no test until this one existed,
    // which is exactly how a guard ends up decorative.
    const junk = {
      id: "a",
      date: "2026-08-05",
      offDays: "nervous but hopeful",
    } as unknown as ShotEntry;
    const row = toCsv([junk]).split("\n")[1];
    expect(row).not.toContain("nervous");
  });

  it("writes the pattern out in words, because the slug is a fragment", () => {
    // The one column that does NOT write the value as stored, and the reason is
    // the rule rather than an exception to it: a cell has to be readable on its
    // own. `mild` is. `right-before` is not — right before WHAT is answerable
    // only from the label. A provider reads the CSV without the app beside it.
    const row = toCsv([
      { id: "a", date: "2026-08-05", offDays: "right-before" },
    ]).split("\n")[1];
    expect(row).toContain("Right before this shot");
    expect(row).not.toContain("right-before,");
  });

  it("drops a stored value the enum does not contain, rather than exporting it", () => {
    // `sanitizeShots` vets a non-blank id and date and nothing else, so a
    // free-text mood left over from before this field reaches the picker. It
    // must not be written into a file the app's own importer would then refuse
    // — backup export is the only recovery path this product has.
    const junk = {
      id: "a",
      date: "2026-08-05",
      offDays: "nervous but hopeful",
    } as unknown as ShotEntry;
    const exported = pickShotFields(junk);
    expect("offDays" in exported).toBe(false);
    expect(shotEntrySchema.safeParse(exported).success).toBe(true);
  });
});

describe("a stored level the enum does not contain never leaves the app", () => {
  // The round-trip test above asserts the guarantee only over PAIN_LEVELS, so
  // it cannot see this: `sanitizeShots` vets a non-blank id and date and nothing
  // else, and a bare `!== undefined` copied whatever it found into the backup.
  // Measured before the fix: exporting one such shot and feeding the file
  // straight back gave "None of the 1 entry in this file could be read, so
  // nothing was restored." Backup export is the only recovery path in this
  // product's durability model.
  const junk = {
    id: "a",
    date: "2026-08-05",
    pain: "agony",
  } as unknown as ShotEntry;

  it("is dropped from the backup rather than written into it", () => {
    const exported = pickShotFields(junk);
    expect("pain" in exported).toBe(false);
  });

  it("leaves a backup the app's own importer still accepts", () => {
    // The guarantee that matters, stated as itself rather than per field: the
    // app must never produce a file it refuses to read.
    expect(shotEntrySchema.safeParse(pickShotFields(junk)).success).toBe(true);
  });

  it("is blanked in the CSV rather than shown to a provider", () => {
    // And the two exports must agree. A value the backup drops must not appear
    // verbatim in the file someone prints for a clinician.
    const row = toCsv([junk]).split("\n")[1];
    expect(row).not.toContain("agony");
  });
});

describe("the first-run flag survives a backup", () => {
  // The allowlist trap CLAUDE.md names by name: `pickProfileFields` is an
  // allowlist and `replaceProfile` swaps the whole profile on import, so a
  // field the picker forgets is silently missing from the user's own backup and
  // reverts to its default on restore. Caught by mutation — removing the line
  // from the picker broke no test until this one existed, which is exactly how
  // the trap works.
  it("is carried out and back", () => {
    expect(pickProfileFields({ firstRunDone: true }).firstRunDone).toBe(true);
    const parsed = profileSchema.safeParse(
      pickProfileFields({ firstRunDone: true }),
    );
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.firstRunDone).toBe(true);
  });

  it("is dropped when it is not a boolean", () => {
    // localStorage is hand-editable and import is untrusted; a truthy "yes"
    // would hide the first-run card for good with no way back short of editing
    // storage again.
    expect(
      "firstRunDone" in
        pickProfileFields({ firstRunDone: "yes" } as unknown as Profile),
    ).toBe(false);
  });

  it("does not invent a dismissal for a profile that has none", () => {
    expect("firstRunDone" in pickProfileFields({})).toBe(false);
  });
});

describe("a dismissal alone is not user data", () => {
  // `hasProfileData` answers "is there anything here worth protecting?" for two
  // decisions, and the first-run flag is not an answer to it. It still travels
  // in the DTO — dropping it there is the allowlist trap — it just must not
  // count.
  it("does not treat the first-run flag as data", () => {
    expect(hasProfileData({ firstRunDone: true })).toBe(false);
  });

  it("still counts real fields, alone or beside the flag", () => {
    expect(hasProfileData({ preferredName: "Lou" })).toBe(true);
    expect(hasProfileData({ firstRunDone: true, intervalDays: 7 })).toBe(true);
  });

  it("is false for an empty profile, as before", () => {
    expect(hasProfileData({})).toBe(false);
  });
});
