// src/utils/datetime.ts
// Local wall-clock date/time helpers.
//
// A shot log records a *civil* date/time — the day and time in the user's own
// life — not an absolute UTC instant. Civil values are timezone-independent
// ("floating"), so they must be derived from LOCAL components. Using
// Date.toISOString() (which is UTC) would shift the date by a day for anyone
// west of UTC logging in the evening (e.g. 8pm Pacific → tomorrow's date).
// Storing the plain local "YYYY-MM-DD" also travels correctly through any future
// cross-device sync without timezone conversion.
import { unsafeCivilDate, type CivilDate } from "./civilDate";

/** Local calendar date of `d` as YYYY-MM-DD (not UTC). Provably a real date —
 *  built from padded local components — so it's branded as a `CivilDate` without
 *  re-validating. Guards against an Invalid Date (e.g. `new Date("garbage")`,
 *  whose components are all NaN): branding "NaN-NaN-NaN" would hand the type
 *  system a value it trusts as a real date, quietly breaking the CivilDate
 *  invariant at this producer. */
export function localISODate(d: Date = new Date()): CivilDate {
  if (Number.isNaN(d.getTime())) {
    throw new RangeError("localISODate: received an Invalid Date");
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return unsafeCivilDate(`${y}-${m}-${day}`);
}

/** Today's local date as YYYY-MM-DD (a `CivilDate`). */
export function todayLocalISO(): CivilDate {
  return localISODate();
}

/** Current local wall-clock time as HH:MM (24-hour). */
export function nowHHMM(d: Date = new Date()): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * A stored `HH:MM` rendered the way this device writes times — "8:30 AM" in the
 * US, "08:30" where the 24-hour clock is the norm.
 *
 * The STORED value stays 24-hour `HH:MM`: it sorts, compares and round-trips
 * through a backup as itself, and only the display is localised. That split is
 * the point — a value formatted for a reader is not a value.
 *
 * Locale rather than a hardcoded 12-hour clock, because "which clock" is the
 * reader's convention and not ours to pick; `Intl` already knows, and the app's
 * own `<input type="time">` is localised by the browser on exactly the same
 * basis, so the two agree by construction.
 *
 * The date attached is arbitrary and never shown — `Intl` needs a Date, and a
 * fixed local noon avoids both DST edges and any timezone shifting the hour.
 */
export function formatTimeForDisplay(time: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return time; // not ours to interpret; show it as stored
  const [, hh, mm] = match;
  const hours = Number(hh);
  const minutes = Number(mm);
  if (hours > 23 || minutes > 59) return time;
  const at = new Date(2000, 0, 1, hours, minutes);
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(at);
}
