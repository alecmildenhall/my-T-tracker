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

/** Local calendar date of `d` as YYYY-MM-DD (not UTC). */
export function localISODate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Today's local date as YYYY-MM-DD. */
export function todayLocalISO(): string {
  return localISODate();
}

/** Current local wall-clock time as HH:MM (24-hour). */
export function nowHHMM(d: Date = new Date()): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
