// src/types/profile.ts

// Optional, local-only personalization for HRT milestones.
//
// Deliberately separate from ShotEntry: this holds a preferred name (identity
// data that ShotEntry must never contain) and the T start date. It lives under
// its own storage key and, like everything else, never leaves the device.
// Every field is optional — the app is fully usable without setting any of it.
import type { Weekday } from "../utils/weekday";

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
}
