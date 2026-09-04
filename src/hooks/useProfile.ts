// src/hooks/useProfile.ts
import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage";
import type { Profile } from "../types/profile";
import { isValidIntervalDays } from "../types/profile";
import { isShotDateInRange } from "../utils/civilDate";
import type { Weekday } from "../utils/weekday";
import { STORAGE_KEYS } from "../storageKeys";
import { isBlank } from "../utils/strings";
import { isWeekday } from "../utils/weekday";

export interface UseProfile {
  profile: Profile;
  /** Set (or clear, with undefined) the T start date. */
  setStartDate: (date: string | undefined) => void;
  /** Set (or clear, with undefined) the preferred name. */
  setPreferredName: (name: string | undefined) => void;
  /** Set (or clear, with undefined) the shot-day weekday. */
  setShotDay: (day: Weekday | undefined) => void;
  /** Days between shots. `undefined` clears it, which stops planned dates
   *  being computed rather than falling back to a guess. */
  setIntervalDays: (days: number | undefined) => void;
  /** The date the schedule grid is aligned to. Written once, the first time a
   *  planned date needs one — see `planShot`. */
  setScheduleAnchor: (date: string | undefined) => void;
  /** Merge a partial patch into the profile. */
  updateProfile: (patch: Partial<Profile>) => void;
  /**
   * Replace the whole profile (used when restoring a backup). Passing {} clears
   * it. Returns whether it reached storage, so a restore can be reported as the
   * failure it was rather than announcing entries it never wrote.
   */
  replaceProfile: (next: Profile) => boolean;
}

const EMPTY: Profile = {};

/**
 * Drop the two known optional string fields from `o` unless they're a non-blank
 * string, so an optional field is never carried as "" (or a non-string). Unknown
 * fields are left untouched — see coerce/updateProfile for why.
 */
function normalizeKnownFields(o: Record<string, unknown>): void {
  if (isBlank(o.startDate)) delete o.startDate;
  if (isBlank(o.preferredName)) delete o.preferredName;
  // shotDay is an enum, not free text: drop anything that isn't one of the seven
  // weekday keys (a hand-edit, an old value, or "" from a cleared <select>).
  if (!isWeekday(o.shotDay)) delete o.shotDay;
  // The third boundary. Import and export were both hardened first, and this
  // one was missed: localStorage is hand-editable, and a string "14" or a 7.5
  // flowed straight into a field typed `number`. The save path's own guard did
  // not catch it either — `!"abc"` is false and `"abc" <= 0` is false — so the
  // shot ended up with a planned date of "NaN-NaN-NaN".
  if (!isValidIntervalDays(o.intervalDays)) delete o.intervalDays;
  // The same date rule as import and export, not merely "non-blank". A
  // hand-edited "9999-01-01" used to survive here and then freeze a year-9999
  // planned date onto every subsequent shot — shown in History and written into
  // the CSV a provider reads. That is the class isShotDateInRange exists for.
  if (
    typeof o.scheduleAnchor !== "string" ||
    !isShotDateInRange(o.scheduleAnchor)
  ) {
    delete o.scheduleAnchor;
  }
  // The storage read boundary, like every field above. A hand-edited
  // `"firstRunDone": "yes"` is truthy and would hide the first-run card for
  // good with no way back short of editing storage again.
  if (typeof o.firstRunDone !== "boolean") delete o.firstRunDone;
}

/**
 * Coerce whatever is in storage into a usable Profile. localStorage is untrusted
 * (corruptable, hand-editable, or from an older app version), so a successful
 * JSON.parse doesn't guarantee the shape. Non-objects fall back to empty. Unknown
 * fields are preserved (like sanitizeShots) so a field written by a newer build
 * isn't stripped when an older one reads and rewrites the profile.
 */
function sanitizeProfile(raw: unknown): Profile {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const clean: Record<string, unknown> = {
    ...(raw as Record<string, unknown>),
  };
  normalizeKnownFields(clean);
  return clean as Profile;
}

/**
 * Note the deliberate split below: `replaceProfile` writes through (and reports),
 * while the per-field setters stay optimistic on plain `setProfile`.
 *
 * It is NOT the mix `useShots` warns about, and it must not be "fixed" into
 * write-through everywhere. These fields are bound to inputs the user types into
 * a character at a time, and `persist` only commits state when the write lands —
 * so on a device refusing writes, a write-through name field would refuse to
 * show the letters being typed into it. Silently discarding keystrokes is a far
 * worse failure than optimistically showing a name the banner is simultaneously
 * saying isn't saved.
 *
 * A restore is the opposite kind of event: one deliberate, destructive action
 * whose result the user needs told, and nothing to type into.
 *
 * The constraint the two share: never call a write-through and an optimistic
 * mutation of this store in the same tick. `setProfile` queues its update for
 * React to apply later, so a `persistProfile` call alongside it would read a
 * snapshot that predates it and write the stale profile back — the shape that
 * resurrected a deleted shot in `useShots`. Nothing does this today;
 * `replaceProfile` ignores `prev` entirely and is only reached from import.
 */
export function useProfile(): UseProfile {
  const [profile, setProfile, persistProfile] = useLocalStorage<Profile>(
    STORAGE_KEYS.profile,
    EMPTY,
    { sanitize: sanitizeProfile },
  );

  const updateProfile = useCallback(
    (patch: Partial<Profile>) => {
      setProfile((prev) => {
        // Merge, then drop any now-blank known field so it's never stored as "".
        // The value is kept exactly as typed (no trim) — trimming per keystroke
        // would stop a name with spaces from being entered; rendering trims at
        // point of use. Unknown fields carried by prev are preserved.
        const next: Record<string, unknown> = { ...prev, ...patch };
        normalizeKnownFields(next);
        return next as Profile;
      });
    },
    [setProfile],
  );

  const replaceProfile = useCallback(
    (next: Profile) => {
      // Full replace, not a merge: drop any now-blank known field so a restored
      // profile is normalized the same way a typed one is. Discards the previous
      // profile entirely (including unknown fields) — the backup is the snapshot.
      // Writes through, so an import can be all-or-nothing with the shots half.
      return persistProfile(() => {
        const clean: Record<string, unknown> = { ...next };
        normalizeKnownFields(clean);
        return clean as Profile;
      });
    },
    [persistProfile],
  );

  const setStartDate = useCallback(
    (date: string | undefined) => updateProfile({ startDate: date }),
    [updateProfile],
  );

  const setPreferredName = useCallback(
    (name: string | undefined) => updateProfile({ preferredName: name }),
    [updateProfile],
  );

  const setShotDay = useCallback(
    // Changing your day clears the anchor, so the next save re-establishes the
    // grid on the new weekday.
    //
    // Freezing the anchor protects it from ACCIDENTAL movement — backdating a
    // remembered shot, deleting the oldest one — and that is still right. But
    // choosing a different shot day is the one input that should repoint it,
    // and without this it did nothing at all: the grid stayed on Wednesday
    // while the greeting moved to Friday, so a shot logged on the new day read
    // "taken 2 days after" forever, with no way to repair it.
    (day: Weekday | undefined) =>
      updateProfile({ shotDay: day, scheduleAnchor: undefined }),
    [updateProfile],
  );

  const setIntervalDays = useCallback(
    // Clears the anchor for the same reason setShotDay does: changing your
    // cadence is a deliberate re-declaration of the schedule, and the anchor is
    // frozen against ACCIDENTAL movement, not against you.
    //
    // Without this a weekly user switching to fortnightly kept a grid on the
    // old phase: measured, every fortnightly shot then read "taken 7 days
    // before", forever, frozen — schedule.ts's own named failure reaching in
    // through the interval instead of the anchor. It was unrepairable too,
    // since re-picking a shot day re-derives from the earliest shot, which is
    // still on the old phase.
    (days: number | undefined) =>
      updateProfile({ intervalDays: days, scheduleAnchor: undefined }),
    [updateProfile],
  );

  const setScheduleAnchor = useCallback(
    (date: string | undefined) => updateProfile({ scheduleAnchor: date }),
    [updateProfile],
  );

  return {
    profile,
    setStartDate,
    setPreferredName,
    setShotDay,
    setIntervalDays,
    setScheduleAnchor,
    updateProfile,
    replaceProfile,
  };
}
