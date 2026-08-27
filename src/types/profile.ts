// src/types/profile.ts

// Optional, local-only personalization for HRT milestones.
//
// Deliberately separate from ShotEntry: this holds a preferred name (identity
// data that ShotEntry must never contain) and the T start date. It lives under
// its own storage key and, like everything else, never leaves the device.
// Every field is optional — the app is fully usable without setting any of it.
import type { Weekday } from "../utils/weekday";

/**
 * Bounds on `intervalDays`, exported so the DTO allowlist and the import schema
 * read the same numbers.
 *
 * They had drifted for one commit: the schema capped at 365 while the DTO had no
 * upper bound, so the app could export a profile its own importer refused — and
 * because the profile is atomic, that costs the user the whole thing on restore.
 * A backup the app cannot read is the worst outcome this product can produce.
 *
 * The upper bound is generous rather than clinical. The app has no business
 * ruling on anyone's regimen; it only stops a value that makes the schedule grid
 * nonsense.
 */
export const MIN_INTERVAL_DAYS = 1;
export const MAX_INTERVAL_DAYS = 365;

/** Whole days, within bounds — the one rule every boundary applies. */
export function isValidIntervalDays(v: unknown): v is number {
  return (
    typeof v === "number" &&
    Number.isInteger(v) &&
    v >= MIN_INTERVAL_DAYS &&
    v <= MAX_INTERVAL_DAYS
  );
}

export interface Profile {
  /** Local calendar date HRT started (YYYY-MM-DD). May predate app install, and
   *  may be in the future (someone planning to start T later). */
  startDate?: string;
  /** How the user likes to be addressed in milestone messages. Free text. */
  preferredName?: string;
  /** Optional weekday for a celebratory "Happy shot day!" greeting, and — since
   *  cadence landed — the day the shot schedule is aligned to. Absent means no
   *  shot-day greeting at all, and no planned dates: there is no guessing from
   *  logged shots, in either direction. */
  shotDay?: Weekday;
  /** How many days the user normally leaves between shots. Optional, and
   *  deliberately NOT defaulted.
   *
   *  A default of 7 would be uniquely harmful because a shot's planned date is
   *  frozen at save time: a fortnightly user who never opened Settings would
   *  accumulate months of shots measured against a schedule they were never on,
   *  and correcting the setting afterwards would repair none of them. Absent
   *  means no planned date is computed at all — see `plannedDateOnSave`. */
  intervalDays?: number;
  /** The date the shot schedule is aligned to (YYYY-MM-DD), established once
   *  from the first shot logged with a shot day set, then frozen.
   *
   *  Stored rather than derived, and that distinction was a bug rather than a
   *  preference: working it out as "the earliest shot, snapped to shot day"
   *  meant backdating a remembered shot — or deleting the oldest one — silently
   *  repointed the grid for every shot saved afterwards. On a fortnightly
   *  schedule a 7-day shift flips which week the grid falls on, so an on-rhythm
   *  shot froze as "7 days before" and stayed there. */
  scheduleAnchor?: string;
}
