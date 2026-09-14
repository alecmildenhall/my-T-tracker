// src/types/profile.ts

// Optional, local-only personalization for HRT milestones.
//
// Deliberately separate from ShotEntry: this holds a preferred name (identity
// data that ShotEntry must never contain) and the T start date. It lives under
// its own storage key and, like everything else, never leaves the device.
// Every field is optional — the app is fully usable without setting any of it.
import type { Weekday } from "../utils/weekday";

/** Which rhythm a user times their shots by. */
export type ScheduleMode = "grid" | "rolling" | "none";

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
  /** Which weekdays the user injects on, and the days the shot schedule is
   *  aligned to. Empty or absent means no shot-day greeting and no planned
   *  dates: there is no guessing from logged shots, in either direction.
   *
   *  A SET rather than a single day, because twice-weekly TRT — Monday and
   *  Thursday, to flatten peaks and troughs — is every 3.5 days, and
   *  `intervalDays` is a whole number. That protocol simply could not be
   *  expressed before. Paired with `intervalDays` this is RFC 5545's
   *  decomposition: `shotDays` is BYDAY, `intervalDays / 7` is INTERVAL, under
   *  FREQ=WEEKLY. `[mon, thu]` with 7 is twice weekly; `[wed]` with 14 is the
   *  fortnightly behaviour a single `shotDay` used to carry. */
  shotDays?: Weekday[];
  /** Which rhythm the user said they were on, as opposed to one inferred from
   *  which fields happen to be filled.
   *
   *  Stored because the choice carries information the values cannot. "Every 7
   *  days, counting from my last shot" and "every Wednesday" store the same
   *  `intervalDays: 7`, and inference resolves that collision by returning
   *  `none` — so someone who picked a rhythm would get no planned dates at all
   *  and no explanation. It also separates "I'd rather not track this" from
   *  "never answered", which are the same absence and different facts.
   *
   *  Absent means a profile written before this existed (or an old backup), and
   *  is inferred from the values — see `effectiveScheduleMode`. */
  scheduleMode?: ScheduleMode;
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
  /** Whether the first-run card has been dismissed with its Done button.
   *
   *  Stored, and that is a reversal worth naming: the card originally had no
   *  dismiss control at all, on the reasoning that it vanishes once a shot
   *  exists, so there was nothing to store. True, and it cost the thing this
   *  fixes — you fill the card in and nothing acknowledges it, so the only way
   *  to make it go is to log a shot, which is not obviously connected.
   *
   *  "Has the user dismissed this?" is a decision they made, not a fact about
   *  their data, so it cannot be derived from one — which is why storing it is
   *  the right call rather than a violation of the derive-don't-store rule. The
   *  card still also disappears once any shot exists, so an import clears it
   *  for free and the flag is a second route, not the only one. */
  firstRunDone?: boolean;
}
